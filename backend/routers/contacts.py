from fastapi import APIRouter, status

from backend.db import transaction
from backend.routers import Engine, RecordId
from backend.schemas import ContactDetail, ContactIn, ContactPatch, ContactRow
from backend.services import contacts

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactRow])
def list_contacts(engine: Engine) -> list[dict]:
    with transaction(engine) as conn:
        return contacts.list_all(conn)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ContactRow)
def add_contact(body: ContactIn, engine: Engine) -> dict:
    with transaction(engine) as conn:
        return contacts.add(conn, body.model_dump())


@router.get("/{contact_id}", response_model=ContactDetail)
def get_contact(contact_id: RecordId, engine: Engine) -> dict:
    with transaction(engine) as conn:
        return contacts.get(conn, contact_id)


@router.patch("/{contact_id}", response_model=ContactRow)
def change_contact(contact_id: RecordId, body: ContactPatch, engine: Engine) -> dict:
    with transaction(engine) as conn:
        return contacts.change(conn, contact_id, body.model_dump(exclude_unset=True))


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: RecordId, engine: Engine) -> None:
    with transaction(engine) as conn:
        contacts.delete(conn, contact_id)
