from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, require_admin
from app.services.user_service import UserService
from app.schemas import UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


def get_service() -> UserService:
    return UserService()


@router.get("")
async def list_users(
    _user: CurrentUser,  # must be authenticated
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
):
    result = await get_service().get_users(
        page=page, limit=limit, role=role,
        search=search, sort_by=sort_by, sort_order=sort_order,
    )
    return {"success": True, **result, "message": "OK"}


@router.get("/{user_id}")
async def get_user(user_id: str, _user: CurrentUser):
    data = await get_service().get_user_by_id(user_id)
    return {"success": True, "data": data, "message": "OK"}


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdate,
    _user: dict = Depends(require_admin),
):
    data = await get_service().update_user(user_id, payload)
    return {"success": True, "data": data, "message": "User updated"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    _user: dict = Depends(require_admin),
):
    await get_service().delete_user(user_id)
    return {"success": True, "message": "User soft-deleted"}
