"""The signed-in person, and the stand-in's sign-in (concern 18)."""

from fastapi import APIRouter, HTTPException, Request, status

from backend import settings
from backend.auth import STAND_IN_SIGN_IN, CurrentUser, StandInTokens
from backend.schemas import Me, StandInSignIn, StandInToken
from backend.teammates import TEAMMATES

router = APIRouter(prefix="/api/me", tags=["me"])

# Included only with the stand-in on, so with it off this address doesn't exist.
stand_in_router = APIRouter(tags=["stand-in"])

STAND_IN_PASSWORD = "accountable"
TEAMMATES_BY_EMAIL = {teammate.email.lower(): teammate for teammate in TEAMMATES}


@router.get("", response_model=Me)
def get_me(person: CurrentUser) -> dict:
    return {
        "id": person.id,
        "name": person.name,
        "email": person.email,
        "initials": person.initials,
        "timezone": settings.timezone_name(),
    }


@stand_in_router.post(STAND_IN_SIGN_IN, response_model=StandInToken)
def stand_in_sign_in(body: StandInSignIn, request: Request) -> dict:
    """Any teammate's email, in any case, with the password "accountable"."""
    teammate = TEAMMATES_BY_EMAIL.get(body.email.strip().lower())
    if teammate is None or body.password != STAND_IN_PASSWORD:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password.")
    tokens: StandInTokens = request.app.state.tokens
    return tokens.issue(teammate)
