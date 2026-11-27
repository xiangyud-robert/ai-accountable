"""R15: the check that runs before every route under /api, and CurrentUser, the person it found.

It's a middleware rather than a FastAPI dependency, since FastAPI matches the route and reads
the body before any dependency runs, which would answer someone signed out with a 404, 405
or 422 instead of a 401.

Supabase's tokens are checked against the project's public signing keys. The stand-in's
(concern 18) are signed with a key the backend makes when it starts and keeps only in
memory. Only one of the two kinds is accepted, depending on how the backend started.
Expiry is checked against the real clock, never backend.clock, which tests fix to a date.
"""

import logging
import secrets
import time
from typing import Annotated, Protocol

import jwt
from fastapi import Depends, Request
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from backend import db
from backend.services import users
from backend.services.users import Person
from backend.teammates import Teammate

log = logging.getLogger(__name__)

STAND_IN_SIGN_IN = "/api/stand-in/sign-in"
SIGNED_IN = "authenticated"  # Supabase's audience and role for a signed-in user
STAND_IN_ISSUER = "accountable-stand-in"
STAND_IN_HOURS = 12
REQUIRED_CLAIMS = ["exp", "sub", "iss", "aud"]
# Only keys that sign with a private key and check with a public one. Never HS256 or none.
PUBLIC_KEY_ALGORITHMS = frozenset(
    {"RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"}
)
JWKS_TIMEOUT_SECONDS = 10

SIGN_IN_TO_CARRY_ON = "Sign in to carry on."
CANT_REACH_SIGN_IN = "Can't reach the sign-in service. Try again in a moment."


class InvalidToken(Exception):
    pass


def _person_from(claims: dict) -> Person:
    user_id, email = claims.get("sub"), claims.get("email")
    if not isinstance(user_id, str) or not user_id or not isinstance(email, str) or not email:
        raise InvalidToken("The token doesn't name a person with an email.")
    metadata = claims.get("user_metadata")
    display_name = metadata.get("display_name") if isinstance(metadata, dict) else None
    return users.person(user_id, email, display_name)


class Tokens(Protocol):
    open_paths: frozenset[str]

    def check(self, token: str) -> Person: ...


class StandInTokens:
    """Concern 18: tokens for the sample teammates, for this computer only."""

    open_paths = frozenset({STAND_IN_SIGN_IN})

    def __init__(self) -> None:
        self._key = secrets.token_bytes(32)

    def issue(self, teammate: Teammate) -> dict:
        expires_at = int(time.time()) + STAND_IN_HOURS * 3600
        claims = {
            "sub": teammate.id,
            "email": teammate.email,
            "user_metadata": {"display_name": teammate.display_name},
            "aud": SIGNED_IN,
            "role": SIGNED_IN,
            "iss": STAND_IN_ISSUER,
            "exp": expires_at,
        }
        return {
            "access_token": jwt.encode(claims, self._key, algorithm="HS256"),
            "expires_at": expires_at,
        }

    def check(self, token: str) -> Person:
        claims = jwt.decode(
            token,
            self._key,
            algorithms=["HS256"],
            audience=SIGNED_IN,
            issuer=STAND_IN_ISSUER,
            options={"require": REQUIRED_CLAIMS},
        )
        return _person_from(claims)


class SupabaseTokens:
    """Tokens from Supabase Auth, checked against the project's public keys (concern 20)."""

    open_paths: frozenset[str] = frozenset()

    def __init__(self, url: str, publishable_key: str | None) -> None:
        self.issuer = f"{url}/auth/v1"
        # Supabase's API gateway may want the publishable key, and it's not secret, so it's
        # always sent. Some gateways turn away Python's default User-Agent.
        headers = {"User-Agent": "Accountable"}
        if publishable_key:
            headers["apikey"] = publishable_key
        # PyJWKClient keeps the keys, and fetches them again only when they're 5 minutes
        # old, or for a key it hasn't seen, at most every 30 seconds.
        self.keys = jwt.PyJWKClient(
            f"{self.issuer}/.well-known/jwks.json", headers=headers, timeout=JWKS_TIMEOUT_SECONDS
        )

    def check(self, token: str) -> Person:
        key = self.keys.get_signing_key_from_jwt(token)
        if key.algorithm_name not in PUBLIC_KEY_ALGORITHMS:
            raise InvalidToken(f"Supabase's key uses {key.algorithm_name}, which isn't allowed.")
        claims = jwt.decode(
            token,
            key,
            algorithms=[key.algorithm_name],
            audience=SIGNED_IN,
            issuer=self.issuer,
            options={"require": REQUIRED_CLAIMS},
        )
        if claims.get("role") != SIGNED_IN or claims.get("is_anonymous"):
            raise InvalidToken("The token isn't for a signed-in user.")
        return _person_from(claims)


def _is_api(path: str) -> bool:
    return path == "/api" or path.startswith("/api/")


def _bearer_token(scope: Scope) -> str:
    scheme, _, token = Headers(scope=scope).get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise InvalidToken("No bearer token.")
    return token.strip()


def _refuse(status_code: int, detail: str) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if status_code == 401 else None
    return JSONResponse({"detail": detail}, status_code=status_code, headers=headers)


class SignInWall:
    """Refuses any /api address without a valid token, whether or not it exists, before
    anything else is checked. Pages outside /api pass, since the sign-in screen has to load."""

    def __init__(self, app: ASGIApp, tokens: Tokens) -> None:
        self.app = app
        self.tokens = tokens

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or not _is_api(path) or path in self.tokens.open_paths:
            await self.app(scope, receive, send)
            return
        try:
            # Fetching Supabase's keys and the database work both block, so they run in the
            # thread pool and don't hold up other requests.
            someone = await run_in_threadpool(self._sign_in, scope)
        except jwt.PyJWKClientConnectionError as error:
            log.warning("Couldn't fetch Supabase's signing keys: %s", error)
            await _refuse(503, CANT_REACH_SIGN_IN)(scope, receive, send)
            return
        except (InvalidToken, jwt.PyJWTError):
            await _refuse(401, SIGN_IN_TO_CARRY_ON)(scope, receive, send)
            return
        scope.setdefault("state", {})["person"] = someone
        await self.app(scope, receive, send)

    def _sign_in(self, scope: Scope) -> Person:
        someone = self.tokens.check(_bearer_token(scope))
        with db.transaction(scope["app"].state.engine) as conn:
            users.remember(conn, someone)
        return someone


def _current_user(request: Request) -> Person:
    # Set by SignInWall, from the token alone. Never from anything else in the request.
    return request.state.person


CurrentUser = Annotated[Person, Depends(_current_user)]
