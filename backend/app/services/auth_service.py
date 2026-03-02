from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from app.repositories.user_repo import UserRepository
from app.schemas import RegisterRequest, LoginRequest, UserResponse


class AuthService:
    """Business logic for authentication."""

    @property
    def repo(self) -> UserRepository:
        return UserRepository()

    async def register(self, payload: RegisterRequest) -> tuple[dict, str, str]:
        """Register a new user. Returns (user_dict, access_token, refresh_token)."""
        existing = await self.repo.find_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user_data = {
            "email": payload.email,
            "full_name": payload.full_name,
            "hashed_password": hash_password(payload.password),
            "role": payload.role,
            "is_active": True,
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        user = await self.repo.create(user_data)
        access_token = create_access_token({"sub": user["id"], "role": user["role"]})
        refresh_token = create_refresh_token({"sub": user["id"]})
        return user, access_token, refresh_token

    async def login(self, payload: LoginRequest) -> tuple[dict, str, str]:
        """Authenticate user. Returns (user_dict, access_token, refresh_token)."""
        user = await self.repo.find_by_email(payload.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not verify_password(payload.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account deactivated",
            )

        access_token = create_access_token({"sub": user["id"], "role": user["role"]})
        refresh_token = create_refresh_token({"sub": user["id"]})
        return user, access_token, refresh_token

    @staticmethod
    def to_response(user: dict) -> dict:
        """Strip sensitive fields and map to response shape."""
        return UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            avatar=user.get("avatar"),
            is_active=user["is_active"],
            created_at=user["created_at"],
            updated_at=user["updated_at"],
        ).model_dump()
