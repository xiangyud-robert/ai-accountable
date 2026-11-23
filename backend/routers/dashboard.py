from fastapi import APIRouter

from backend.db import transaction
from backend.routers import Engine
from backend.schemas import Dashboard
from backend.services import dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(engine: Engine) -> Dashboard:
    with transaction(engine) as conn:
        return dashboard.figures(conn)
