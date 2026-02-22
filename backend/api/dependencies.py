"""
FastAPI dependencies for dependency injection.
Provides database session management and authentication.
"""

from typing import Generator
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from ..data_pipeline.models import DatabaseManager, User
from ..data_pipeline.config import DatabaseConfig

# Initialize database manager (singleton)
db_config = DatabaseConfig()
db_manager = DatabaseManager(db_config)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT configuration (should match main.py settings)
SECRET_KEY = "your-secret-key-change-in-production"  # TODO: Move to environment variable
ALGORITHM = "HS256"


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a database session.
    Automatically handles commit/rollback and closing the session.

    Usage:
        @router.get("/endpoint")
        def endpoint(session: Session = Depends(get_db)):
            # Use session here
            pass
    """
    session = db_manager.get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_db)
) -> dict:
    """
    FastAPI dependency that extracts and validates the current user from JWT token.

    Returns:
        dict with keys: id, username, is_admin

    Raises:
        HTTPException 401 if token is invalid
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return {
        "id": user.id,
        "username": user.username,
        "is_admin": user.is_admin
    }


def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency that ensures the current user is an admin.

    Raises:
        HTTPException 403 if user is not an admin
    """
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
