"""The FastAPI app. uvicorn uses the module-level app; tests call create_app() themselves."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend import clock, db, seed
from backend.errors import Invalid, NotFound
from backend.routers import activities, contacts, dashboard, deals, organizations, stages
from backend.schemas import MESSAGES

# The names this computer answers to, with any port. The frontend's dev server passes on
# the address the browser used, such as localhost:5173.
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = db.make_engine()
    if db.migrate(engine):
        # A new database gets the sample data, so every screen has something on it.
        with db.transaction(engine) as conn:
            seed.load(conn, clock.today())
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


def create_app() -> FastAPI:
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
    # Only requests addressed to this computer, so a web page that points its own name at
    # 127.0.0.1 (DNS rebinding) can't use the API.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)
    for module in (stages, organizations, contacts, deals, activities, dashboard):
        app.include_router(module.router)
    return app


app = create_app()
