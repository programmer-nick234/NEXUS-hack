"""
Seed script — creates a dev user and prints login credentials.
Run:  python seed.py
"""

import asyncio
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.security import hash_password
from app.db import connect_db, close_db, get_db

settings = get_settings()

DEV_USER = {
    "email": "dev@nexus.io",
    "full_name": "Dev User",
    "hashed_password": hash_password("password123"),
    "role": "admin",
    "is_active": True,
    "is_deleted": False,
    "created_at": datetime.now(timezone.utc),
    "updated_at": datetime.now(timezone.utc),
}


async def seed():
    await connect_db()
    db = get_db()
    users = db["users"]

    existing = await users.find_one({"email": DEV_USER["email"]})
    if existing:
        print(f"✓ Dev user already exists  →  {DEV_USER['email']}")
    else:
        await users.insert_one(DEV_USER)
        print(f"✓ Created dev user  →  {DEV_USER['email']}")

    print(f"  Email:    {DEV_USER['email']}")
    print(f"  Password: password123")
    print(f"  Role:     {DEV_USER['role']}")

    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
