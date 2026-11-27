from fastapi import APIRouter, status

from backend.auth import CurrentUser
from backend.db import transaction
from backend.routers import Engine, RecordId
from backend.schemas import OrganizationDetail, OrganizationIn, OrganizationPatch, OrganizationRow
from backend.services import organizations

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationRow])
def list_organizations(engine: Engine) -> list[dict]:
    with transaction(engine) as conn:
        return organizations.list_all(conn)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=OrganizationRow)
def add_organization(body: OrganizationIn, engine: Engine, person: CurrentUser) -> dict:
    with transaction(engine) as conn:
        return organizations.add(conn, body.model_dump(), by=person.id)


@router.get("/{organization_id}", response_model=OrganizationDetail)
def get_organization(organization_id: RecordId, engine: Engine) -> dict:
    with transaction(engine) as conn:
        return organizations.get(conn, organization_id)


@router.patch("/{organization_id}", response_model=OrganizationRow)
def change_organization(
    organization_id: RecordId, body: OrganizationPatch, engine: Engine, person: CurrentUser
) -> dict:
    with transaction(engine) as conn:
        return organizations.change(
            conn, organization_id, body.model_dump(exclude_unset=True), by=person.id
        )


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(organization_id: RecordId, engine: Engine) -> None:
    with transaction(engine) as conn:
        organizations.delete(conn, organization_id)
