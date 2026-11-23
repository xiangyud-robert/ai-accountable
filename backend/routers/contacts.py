from fastapi import APIRouter, status

from backend.db import transaction
from backend.routers import Engine
from backend.schemas import ContactDetail, ContactIn, ContactPatch, ContactRow
from backend.services import contacts

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("")
def list_contacts(engine: Engine) -> list[ContactRow]:
    with transaction(engine) as conn:
        return contacts.list_all(conn)


@router.post("", status_code=status.HTTP_201_CREATED)
def add_contact(body: ContactIn, engine: Engine) -> ContactRow:
    with transaction(engine) as conn:
        return contacts.add(conn, body.model_dump())


@router.get("/{contact_id}")
def get_contact(contact_id: int, engine: Engine) -> ContactDetail:
    with transaction(engine) as conn:
        return contacts.get(conn, contact_id)


@router.patch("/{contact_id}")
def change_contact(contact_id: int, body: ContactPatch, engine: Engine) -> ContactRow:
    with transaction(engine) as conn:
        return contacts.change(conn, contact_id, body.model_dump(exclude_unset=True))


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, engine: Engine) -> None:
    with transaction(engine) as conn:
        contacts.delete(conn, contact_id)
