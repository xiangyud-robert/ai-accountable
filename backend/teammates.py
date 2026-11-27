"""The four made-up teammates in the sample data (docs/specs/sample-data.md).

They have no Supabase accounts, so they sign in only through the stand-in, on this
computer (concern 18). Their ids start with zeros, so they can't be the same as a real
Supabase user's.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Teammate:
    id: str
    email: str
    display_name: str


TEAMMATES = (
    Teammate("00000000-0000-4000-8000-000000000001", "dana.holt@example.com", "Dana Holt"),
    Teammate("00000000-0000-4000-8000-000000000002", "joel.abara@example.com", "Joel Abara"),
    Teammate(
        "00000000-0000-4000-8000-000000000003", "nora.lindqvist@example.com", "Nora Lindqvist"
    ),
    Teammate("00000000-0000-4000-8000-000000000004", "wes.moreno@example.com", "Wes Moreno"),
)
