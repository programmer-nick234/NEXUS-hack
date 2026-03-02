from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(str):
    """Custom type to handle MongoDB ObjectId serialisation."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v: object) -> str:
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str) and ObjectId.is_valid(v):
            return v
        raise ValueError("Invalid ObjectId")


class UserModel(BaseModel):
    """Internal user model (maps to MongoDB document)."""

    id: Optional[str] = Field(None, alias="_id")
    email: str
    full_name: str
    hashed_password: str
    role: str = "student"  # student | admin | mentor | superadmin
    avatar: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False  # soft-delete flag
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}
