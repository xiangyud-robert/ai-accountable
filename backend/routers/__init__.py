"""One router for each kind of record. Each route checks its input, then runs one service
call inside `with transaction(engine) as conn:`, so the commit happens before it replies."""

from typing import Annotated

import sqlalchemy as sa
from fastapi import Depends, Path, Request

from backend.schemas import MAX_ID


def _engine(request: Request) -> sa.Engine:
    return request.app.state.engine


Engine = Annotated[sa.Engine, Depends(_engine)]

# A record's id in the address. One that can't be a record's id is a missing record (main.py).
RecordId = Annotated[int, Path(le=MAX_ID)]
