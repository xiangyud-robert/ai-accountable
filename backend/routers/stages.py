from fastapi import APIRouter

from backend import stages
from backend.schemas import StageOut

router = APIRouter(prefix="/api/stages", tags=["stages"])


@router.get("", response_model=list[StageOut])
def list_stages() -> list[dict]:
    return stages.as_dicts()
