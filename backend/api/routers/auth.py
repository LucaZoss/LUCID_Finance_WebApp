"""
Authentication endpoints for user management and login.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import authenticate_user, create_access_token, get_password_hash
from ..dependencies import get_db, get_current_user, get_admin_user
from ..schemas import LoginRequest, LoginResponse, UserCreate, UserResponse
from ...data_pipeline.models import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest):
    """Authenticate user and return JWT token."""
    user = authenticate_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )

    access_token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "is_admin": user["is_admin"]}
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        username=user["username"],
        is_admin=user["is_admin"]
    )


@router.post("/users", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(get_admin_user),
    session: Session = Depends(get_db)
):
    """Create a new user (admin only)."""
    # Check if username already exists
    existing = session.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create new user
    new_user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        is_admin=user_data.is_admin,
        is_active=True
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    return UserResponse.model_validate(new_user)


@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_user: dict = Depends(get_admin_user),
    session: Session = Depends(get_db)
):
    """List all users (admin only)."""
    users = session.query(User).all()
    return [UserResponse.model_validate(u) for u in users]


@router.get("/me")
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user
