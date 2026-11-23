"""Errors the services raise. main.py turns them into 404 and 422 replies."""


class NotFound(Exception):
    def __init__(self, kind: str):
        super().__init__(f"No such {kind}")
        self.kind = kind


class Invalid(Exception):
    """A field that breaks a rule. The reply is {"errors": {field: message}}."""

    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.errors = {field: message}
