from fastapi import APIRouter, status

from backend.auth import CurrentUser
from backend.db import transaction
from backend.routers import Engine, RecordId
from backend.schemas import ActivityIn, ActivityOut, ActivityPatch
from backend.services import activities

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ActivityOut)
def add_activity(body: ActivityIn, engine: Engine, person: CurrentUser) -> dict:
    with transaction(engine) as conn:
        return activities.add(conn, body.model_dump(exclude_unset=True), by=person.id)


@router.patch("/{activity_id}", response_model=ActivityOut)
def change_activity(
    activity_id: RecordId, body: ActivityPatch, engine: Engine, person: CurrentUser
) -> dict:
    with transaction(engine) as conn:
        return activities.change(
            conn, activity_id, body.model_dump(exclude_unset=True), by=person.id
        )


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: RecordId, engine: Engine) -> None:
    with transaction(engine) as conn:
        activities.delete(conn, activity_id)
