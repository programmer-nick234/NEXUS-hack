from datetime import datetime
from typing import Annotated, Optional, Literal
from pydantic import BaseModel, EmailStr, Field


# ── Auth Schemas ──────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]
    full_name: Annotated[str, Field(min_length=2, max_length=100, alias="fullName")]
    role: Literal["student", "mentor"] = "student"

    model_config = {"populate_by_name": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User Schemas ──────────────────────────────────────────────────────────────


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Annotated[str, Field(alias="fullName")]
    role: str
    avatar: Optional[str] = None
    is_active: Annotated[bool, Field(alias="isActive")]
    created_at: Annotated[datetime, Field(alias="createdAt")]
    updated_at: Annotated[datetime, Field(alias="updatedAt")]

    model_config = {"populate_by_name": True}


class UserUpdate(BaseModel):
    full_name: Annotated[Optional[str], Field(None, min_length=2, max_length=100)]
    avatar: Optional[str] = None
    role: Optional[Literal["student", "admin", "mentor", "superadmin"]] = None


# ── Face Detection Schema ────────────────────────────────────────────────────


class FaceDetectionResponse(BaseModel):
    faces_detected: Annotated[int, Field(alias="facesDetected")]
    confidence: float
    emotion: str
    note: str

    model_config = {"populate_by_name": True}


# ── Generic Response Schemas ─────────────────────────────────────────────────


class ApiResponse(BaseModel):
    success: bool = True
    data: Optional[dict | list | None] = None
    message: str = "OK"


class PaginatedMeta(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
