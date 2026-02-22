"""
Custom HTTP exceptions for the API.
Provides semantic exception classes with appropriate status codes.
"""

from fastapi import HTTPException, status


class ResourceNotFound(HTTPException):
    """Raised when a requested resource doesn't exist."""

    def __init__(self, resource: str, identifier: int | str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} with ID {identifier} not found"
        )


class ResourceAlreadyExists(HTTPException):
    """Raised when trying to create a resource that already exists."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{resource} '{identifier}' already exists"
        )


class UnauthorizedAccess(HTTPException):
    """Raised when a user doesn't have permission for an action."""

    def __init__(self, detail: str = "You don't have permission to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class InvalidInput(HTTPException):
    """Raised when user input is invalid."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class AuthenticationError(HTTPException):
    """Raised when authentication fails."""

    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )
