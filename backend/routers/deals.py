from fastapi import APIRouter, status

from backend.db import transaction
from backend.routers import Engine
from backend.schemas import DealDetail, DealIn, DealMove, DealPatch, DealRow
from backend.services import deals

router = APIRouter(prefix="/api/deals", tags=["deals"])


@router.get("")
def list_deals(engine: Engine) -> list[DealRow]:
    with transaction(engine) as conn:
        return deals.list_all(conn)


@router.post("", status_code=status.HTTP_201_CREATED)
def add_deal(body: DealIn, engine: Engine) -> DealRow:
    with transaction(engine) as conn:
        return deals.add(conn, body.model_dump(exclude_unset=True))


@router.get("/{deal_id}")
def get_deal(deal_id: int, engine: Engine) -> DealDetail:
    with transaction(engine) as conn:
        return deals.get(conn, deal_id)


@router.patch("/{deal_id}")
def change_deal(deal_id: int, body: DealPatch, engine: Engine) -> DealRow:
    with transaction(engine) as conn:
        return deals.change(conn, deal_id, body.model_dump(exclude_unset=True))


@router.post("/{deal_id}/move")
def move_deal(deal_id: int, body: DealMove, engine: Engine) -> DealRow:
    with transaction(engine) as conn:
        return deals.move(conn, deal_id, body.stage, body.index)


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(deal_id: int, engine: Engine) -> None:
    with transaction(engine) as conn:
        deals.delete(conn, deal_id)
