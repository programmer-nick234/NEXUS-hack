from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field


# ── Auth Schemas ──────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: Literal["student", "mentor"] = "student"


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
    full_name: str
    role: str
    avatar: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    avatar: Optional[str] = None
    role: Optional[Literal["student", "admin", "mentor", "superadmin"]] = None


# ── Face Detection Schema ────────────────────────────────────────────────────


class FaceDetectionResponse(BaseModel):
    faces_detected: int = Field(alias="facesDetected")
    confidence: float
    emotion: str
    note: str

    class Config:
        populate_by_name = True


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
