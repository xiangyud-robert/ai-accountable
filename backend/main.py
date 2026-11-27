"""The FastAPI app. uvicorn uses the module-level app; tests call create_app() themselves."""

from contextlib import asynccontextmanager
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from starlette.convertors import Convertor, register_url_convertor
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend import auth, clock, db, seed, settings
from backend.errors import Invalid, NotFound
from backend.routers import (
    activities,
    contacts,
    dashboard,
    deals,
    me,
    organizations,
    search,
    stages,
)
from backend.schemas import MESSAGES

# The names this computer answers to, with any port. The frontend's dev server passes on
# the address the browser used, such as localhost:5173.
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Built by `vite build`, for npm start and Render. npm run dev serves it from Vite instead.
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


def check_settings() -> None:
    """Concerns 16 and 18: settings that can't work stop the backend before it starts, so a
    mistake in Render's settings can't let anyone in without a password."""
    stand_in, supabase = settings.stand_in(), settings.supabase_url()
    if stand_in and supabase:
        raise SystemExit(
            "Accountable won't start with both ACCOUNTABLE_STAND_IN and SUPABASE_URL set. "
            "The stand-in sign-in is only for this computer, without Supabase. Remove one of them."
        )
    if stand_in and not db.is_sqlite(settings.database_url()):
        raise SystemExit(
            "Accountable won't start with ACCOUNTABLE_STAND_IN set and a DATABASE_URL that "
            "isn't SQLite. The stand-in sign-in never runs against the team's database. "
            "npm run dev always uses the stand-in, so unset DATABASE_URL in the shell, or use "
            "npm start for the team's database."
        )
    if not stand_in and not supabase:
        raise SystemExit(
            "Accountable needs a way to sign in. Set SUPABASE_URL to sign in with Supabase, "
            "or ACCOUNTABLE_STAND_IN to use the stand-in on this computer (npm run dev sets it)."
        )
    zone = settings.timezone_name()
    if zone:
        try:
            ZoneInfo(zone)
        except (ZoneInfoNotFoundError, ValueError):
            raise SystemExit(
                f'ACCOUNTABLE_TIMEZONE is "{zone}", which isn\'t a time zone. '
                "Use a name such as Europe/London or America/New_York."
            ) from None


def _tokens() -> auth.Tokens:
    url = settings.supabase_url()
    if url:
        return auth.SupabaseTokens(url, settings.supabase_publishable_key())
    return auth.StandInTokens()


def _load_sample_data(conn) -> None:
    seed.load(conn, clock.today())


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = db.make_engine()
    # A new database gets the sample data, so every screen has something on it.
    db.migrate(engine, on_new=_load_sample_data)
    app.state.engine = engine
    yield
    engine.dispose()


def _message(field: str, error: dict) -> str:
    if error["type"] == "accountable":
        return error["msg"]
    if error["type"] == "string_too_long":
        return f"Keep this to {error['ctx']['max_length']:,} characters or fewer."
    if error["type"] == "extra_forbidden":
        return "Accountable doesn't know this field."
    return MESSAGES.get(field, "Check this field.")


async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # An id in the address that can't be a record's, such as "abc" or one too big to store,
    # is a missing record.
    for error in exc.errors():
        if error["loc"][0] == "path":
            kind = str(error["loc"][-1]).removesuffix("_id")
            return await _not_found(request, NotFound(kind))
    errors: dict[str, str] = {}
    for error in exc.errors():
        field = str(error["loc"][-1]) if len(error["loc"]) > 1 else "body"
        errors.setdefault(field, _message(field, error))
    return JSONResponse({"errors": errors}, status_code=422)


async def _invalid(_request: Request, exc: Invalid) -> JSONResponse:
    return JSONResponse({"errors": exc.errors}, status_code=422)


async def _not_found(_request: Request, exc: NotFound) -> JSONResponse:
    return JSONResponse({"detail": f"This {exc.kind} no longer exists"}, status_code=404)


class _PageAddress(Convertor):
    """Any address not under /api, so an unknown /api address stays the API's JSON 404."""

    regex = r"(?!api(?:/|$)).*"

    def convert(self, value: str) -> str:
        return value

    def to_string(self, value: str) -> str:
        return value


register_url_convertor("page", _PageAddress())


def _built_file(root: Path, path: str) -> Path | None:
    """The file at path inside root, or None. Nothing outside root, such as ../, is served."""
    try:
        file = (root / path).resolve()
        return file if file.is_relative_to(root) and file.is_file() else None
    except (OSError, ValueError):  # a name too long, or with a null byte in it
        return None


def _serve_frontend(app: FastAPI, dist: Path) -> None:
    """The built frontend's files as they are, and the app's page for any other address, so
    the frontend's own addresses, such as /deals/12, work after a refresh."""
    root = dist.resolve()
    index = root / "index.html"

    def page(path: str) -> FileResponse:
        file = _built_file(root, path) if path else None
        if file is not None:
            return FileResponse(file)
        # The page names the current build's files, so the browser asks for it each time.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    app.add_api_route("/{path:page}", page, methods=["GET", "HEAD"], include_in_schema=False)


def create_app(frontend: Path | None = None) -> FastAPI:
    check_settings()
    frontend = frontend or FRONTEND_DIST
    # The API is everything there is: no /docs, /redoc or /openapi.json.
    app = FastAPI(
        title="Accountable",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        exception_handlers={
            RequestValidationError: _validation_error,
            Invalid: _invalid,
            NotFound: _not_found,
        },
    )
    tokens = _tokens()
    app.state.tokens = tokens
    # The last added runs first: the host check, then the sign-in wall (R15).
    app.add_middleware(auth.SignInWall, tokens=tokens)
    # Only requests addressed to this computer, or to Render's address for the service, so a
    # web page that points its own name at 127.0.0.1 (DNS rebinding) can't use the API.
    hosts = [*ALLOWED_HOSTS, *filter(None, [settings.render_hostname()])]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    for module in (stages, organizations, contacts, deals, activities, dashboard, me, search):
        app.include_router(module.router)
    if isinstance(tokens, auth.StandInTokens):
        app.include_router(me.stand_in_router)
    if (frontend / "index.html").is_file():
        _serve_frontend(app, frontend)
    return app


app = create_app()
