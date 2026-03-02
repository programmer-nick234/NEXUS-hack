from datetime import datetime, timezone
from typing import Any, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db import get_db


class UserRepository:
    """Data-access layer for the users collection."""

    COLLECTION = "users"

    def __init__(self, db: AsyncIOMotorDatabase | None = None):
        self.db = db or get_db()
        self.collection = self.db[self.COLLECTION]

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _serialize(doc: dict) -> dict:
        """Convert ObjectId to string for API responses."""
        if doc and "_id" in doc:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
        return doc

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def create(self, data: dict[str, Any]) -> dict:
        result = await self.collection.insert_one(data)
        data["_id"] = result.inserted_id
        return self._serialize(data)

    async def find_by_email(self, email: str) -> Optional[dict]:
        doc = await self.collection.find_one(
            {"email": email, "is_deleted": False}
        )
        return self._serialize(doc) if doc else None

    async def find_by_id(self, user_id: str) -> Optional[dict]:
        doc = await self.collection.find_one(
            {"_id": ObjectId(user_id), "is_deleted": False}
        )
        return self._serialize(doc) if doc else None

    async def update(self, user_id: str, data: dict[str, Any]) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc)
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": data},
        )
        return await self.find_by_id(user_id)

    async def soft_delete(self, user_id: str) -> bool:
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "is_deleted": True,
                    "is_active": False,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.modified_count == 1

    async def hard_delete(self, user_id: str) -> bool:
        result = await self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count == 1

    # ── Pagination ────────────────────────────────────────────────────────────

    async def find_paginated(
        self,
        page: int = 1,
        limit: int = 20,
        filters: dict | None = None,
        sort_by: str = "created_at",
        sort_order: int = -1,
    ) -> tuple[list[dict], int]:
        query = {"is_deleted": False}
        if filters:
            query.update(filters)

        total = await self.collection.count_documents(query)
        skip = (page - 1) * limit

        cursor = (
            self.collection.find(query)
            .sort(sort_by, sort_order)
            .skip(skip)
            .limit(limit)
        )
        docs = [self._serialize(doc) async for doc in cursor]
        return docs, total
