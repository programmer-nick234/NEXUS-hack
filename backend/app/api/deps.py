from typing import Annotated
from fastapi import Depends, HTTPException, Request, status

from app.core.security import decode_token, JWTError
from app.repositories.user_repo import UserRepository


async def get_current_user(request: Request) -> dict:
    """Extract and validate the JWT from the access_token cookie."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid",
        )

    repo = UserRepository()
    user = await repo.find_by_id(user_id)
    if not user or not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]


async def get_optional_user(request: Request) -> dict | None:
    """Like get_current_user but returns None instead of raising 401."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


OptionalUser = Annotated[dict | None, Depends(get_optional_user)]


class RoleChecker:
    """Dependency that verifies the current user has one of the required roles."""

    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: CurrentUser) -> dict:
        if user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user


# Convenience role dependencies
require_admin = RoleChecker(["admin", "superadmin"])
require_mentor = RoleChecker(["mentor", "admin", "superadmin"])
require_superadmin = RoleChecker(["superadmin"])
