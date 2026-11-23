"""The six fixed pipeline stages. The frontend loads them from GET /api/stages."""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Stage:
    key: str
    name: str
    order: int
    probability: int
    open: bool


STAGES: tuple[Stage, ...] = (
    Stage("new", "New", 1, 10, True),
    Stage("qualified", "Qualified", 2, 25, True),
    Stage("proposal", "Proposal", 3, 50, True),
    Stage("negotiation", "Negotiation", 4, 75, True),
    Stage("won", "Won", 5, 100, False),
    Stage("lost", "Lost", 6, 0, False),
)

BY_KEY = {s.key: s for s in STAGES}
KEYS = tuple(s.key for s in STAGES)
OPEN_KEYS = tuple(s.key for s in STAGES if s.open)
CLOSED_KEYS = ("won", "lost")


def name(key: str) -> str:
    return BY_KEY[key].name


def usual_probability(key: str) -> int:
    return BY_KEY[key].probability


def is_open(key: str) -> bool:
    return BY_KEY[key].open


def as_dicts() -> list[dict]:
    return [asdict(s) for s in STAGES]
