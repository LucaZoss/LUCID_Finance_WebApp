"""
FastAPI dependencies for dependency injection.
Provides database session management.
Authentication dependencies are imported from auth module.
"""

from typing import Generator
from sqlalchemy.orm import Session

from ..data_pipeline.models import DatabaseManager
from ..data_pipeline.config import DatabaseConfig
from .auth import get_current_user, get_admin_user

# Initialize database manager (singleton)
db_config = DatabaseConfig()
db_manager = DatabaseManager(db_config)


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


__all__ = ['get_db', 'get_current_user', 'get_admin_user']
