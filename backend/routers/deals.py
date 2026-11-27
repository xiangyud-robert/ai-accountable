from fastapi import APIRouter, status

from backend.auth import CurrentUser
from backend.db import transaction
from backend.routers import Engine, RecordId
from backend.schemas import DealDetail, DealIn, DealMove, DealPatch, DealRow
from backend.services import deals

router = APIRouter(prefix="/api/deals", tags=["deals"])


@router.get("", response_model=list[DealRow])
def list_deals(engine: Engine) -> list[dict]:
    with transaction(engine) as conn:
        return deals.list_all(conn)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DealRow)
def add_deal(body: DealIn, engine: Engine, person: CurrentUser) -> dict:
    with transaction(engine) as conn:
        return deals.add(conn, body.model_dump(exclude_unset=True), by=person.id)


@router.get("/{deal_id}", response_model=DealDetail)
def get_deal(deal_id: RecordId, engine: Engine) -> dict:
    with transaction(engine) as conn:
        return deals.get(conn, deal_id)


@router.patch("/{deal_id}", response_model=DealRow)
def change_deal(deal_id: RecordId, body: DealPatch, engine: Engine, person: CurrentUser) -> dict:
    with transaction(engine) as conn:
        return deals.change(conn, deal_id, body.model_dump(exclude_unset=True), by=person.id)


@router.post("/{deal_id}/move", response_model=DealRow)
def move_deal(deal_id: RecordId, body: DealMove, engine: Engine, person: CurrentUser) -> dict:
    with transaction(engine) as conn:
        return deals.move(conn, deal_id, body.stage, body.index, by=person.id)


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(deal_id: RecordId, engine: Engine) -> None:
    with transaction(engine) as conn:
        deals.delete(conn, deal_id)
