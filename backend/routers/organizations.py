from fastapi import APIRouter, status

from backend.db import transaction
from backend.routers import Engine
from backend.schemas import OrganizationDetail, OrganizationIn, OrganizationPatch, OrganizationRow
from backend.services import organizations

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.get("")
def list_organizations(engine: Engine) -> list[OrganizationRow]:
    with transaction(engine) as conn:
        return organizations.list_all(conn)


@router.post("", status_code=status.HTTP_201_CREATED)
def add_organization(body: OrganizationIn, engine: Engine) -> OrganizationRow:
    with transaction(engine) as conn:
        return organizations.add(conn, body.model_dump())


@router.get("/{organization_id}")
def get_organization(organization_id: int, engine: Engine) -> OrganizationDetail:
    with transaction(engine) as conn:
        return organizations.get(conn, organization_id)


@router.patch("/{organization_id}")
def change_organization(organization_id: int, body: OrganizationPatch, engine: Engine) -> OrganizationRow:
    with transaction(engine) as conn:
        return organizations.change(conn, organization_id, body.model_dump(exclude_unset=True))


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(organization_id: int, engine: Engine) -> None:
    with transaction(engine) as conn:
        organizations.delete(conn, organization_id)
