import math
from fastapi import HTTPException, status

from app.repositories.user_repo import UserRepository
from app.schemas import UserResponse, UserUpdate


class UserService:
    """Business logic for user management."""

    @property
    def repo(self) -> UserRepository:
        return UserRepository()

    async def get_user_by_id(self, user_id: str) -> dict:
        user = await self.repo.find_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return self._to_response(user)

    async def get_users(
        self,
        page: int = 1,
        limit: int = 20,
        role: str | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> dict:
        filters: dict = {}
        if role:
            filters["role"] = role
        if search:
            filters["$or"] = [
                {"email": {"$regex": search, "$options": "i"}},
                {"full_name": {"$regex": search, "$options": "i"}},
            ]

        order = -1 if sort_order == "desc" else 1
        users, total = await self.repo.find_paginated(
            page=page, limit=limit, filters=filters,
            sort_by=sort_by, sort_order=order,
        )

        return {
            "data": [self._to_response(u) for u in users],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total / limit) if limit else 0,
        }

    async def update_user(self, user_id: str, payload: UserUpdate) -> dict:
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )
        user = await self.repo.update(user_id, update_data)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return self._to_response(user)

    async def delete_user(self, user_id: str) -> bool:
        """Soft-delete user."""
        deleted = await self.repo.soft_delete(user_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return True

    @staticmethod
    def _to_response(user: dict) -> dict:
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
