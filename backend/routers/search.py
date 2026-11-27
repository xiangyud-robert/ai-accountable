from typing import Annotated

from fastapi import APIRouter, Query

from backend.db import transaction
from backend.routers import Engine
from backend.schemas import SearchResults
from backend.services import search as search_service

router = APIRouter(prefix="/api/search", tags=["search"])

SEARCH_LENGTH = 200


@router.get("", response_model=SearchResults)
def search(engine: Engine, q: Annotated[str, Query(max_length=SEARCH_LENGTH)] = "") -> dict:
    """R18: what's typed in the top bar's search box. Empty or only spaces finds nothing."""
    with transaction(engine) as conn:
        return search_service.find(conn, q)
