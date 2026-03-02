from fastapi import APIRouter, Request, Response, HTTPException, status

from app.core.security import decode_token, create_access_token, create_refresh_token, JWTError
from app.core.config import get_settings
from app.services.auth_service import AuthService
from app.schemas import RegisterRequest, LoginRequest
from app.api.deps import CurrentUser
from app.repositories.user_repo import UserRepository

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_service() -> AuthService:
    return AuthService()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set HTTP-only secure cookies for access & refresh tokens."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,  # Set True in production with HTTPS
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )


@router.post("/register")
async def register(payload: RegisterRequest, response: Response):
    service = get_service()
    user, access_token, refresh_token = await service.register(payload)
    _set_auth_cookies(response, access_token, refresh_token)
    return {
        "success": True,
        "data": {"user": service.to_response(user)},
        "message": "Registration successful",
    }


@router.post("/login")
async def login(payload: LoginRequest, response: Response):
    service = get_service()
    user, access_token, refresh_token = await service.login(payload)
    _set_auth_cookies(response, access_token, refresh_token)
    return {
        "success": True,
        "data": {"user": service.to_response(user)},
        "message": "Login successful",
    }


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or invalid",
        )

    repo = UserRepository()
    user = await repo.find_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_access = create_access_token({"sub": user["id"], "role": user["role"]})
    new_refresh = create_refresh_token({"sub": user["id"]})
    _set_auth_cookies(response, new_access, new_refresh)

    return {"success": True, "message": "Tokens refreshed"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"success": True, "message": "Logged out"}


@router.get("/me")
async def get_me(user: CurrentUser):
    service = get_service()
    return {
        "success": True,
        "data": service.to_response(user),
        "message": "OK",
    }
