from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Initialize MongoDB connection and create indexes."""
    global _client, _db
    try:
        logger.info("Connecting to MongoDB …")
        _client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
        _db = _client[settings.MONGO_DB_NAME]
        # Test connection
        await _client.admin.command('ping')
        await create_indexes()
        logger.info("MongoDB connected ✓")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}. Proceeding with dummy DB for emotion detection.")
        # Create a mock-like behavior or just keep _db as None
        # In this project, get_db() will raise RuntimeError if _db is None.
        # But we only need face detection which doesn't use the DB.


async def close_db() -> None:
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed ✓")


def get_db() -> AsyncIOMotorDatabase:
    """Return the database instance. Must be called after connect_db."""
    if _db is None:
        raise RuntimeError("Database not initialised. Call connect_db first.")
    return _db


# ── Indexing Strategy ─────────────────────────────────────────────────────────

async def create_indexes() -> None:
    """Create MongoDB indexes for performance at scale."""
    db = get_db()

    # Users collection
    users = db["users"]
    await users.create_index("email", unique=True, background=True)
    await users.create_index("role", background=True)
    await users.create_index("is_active", background=True)
    await users.create_index("is_deleted", background=True)
    await users.create_index(
        [("email", 1), ("is_deleted", 1)],
        background=True,
        name="email_soft_delete",
    )
    await users.create_index(
        [("role", 1), ("is_active", 1)],
        background=True,
        name="role_active_compound",
    )
    await users.create_index("created_at", background=True)

    # Sessions collection
    sessions = db["sessions"]
    await sessions.create_index("userId", background=True)
    await sessions.create_index("endedAt", background=True)
    await sessions.create_index(
        [("userId", 1), ("endedAt", -1)],
        background=True,
        name="user_sessions_recent",
    )

    # User stats collection (gamification)
    user_stats = db["user_stats"]
    await user_stats.create_index("userId", unique=True, background=True)

    # User badges collection
    user_badges = db["user_badges"]
    await user_badges.create_index("userId", background=True)
    await user_badges.create_index(
        [("userId", 1), ("badgeId", 1)],
        unique=True,
        background=True,
        name="user_badge_unique",
    )

    logger.info("MongoDB indexes created ✓")
