import os
# Force legacy Keras for DeepFace compatibility with TF 2.16+
os.environ["TF_USE_LEGACY_KERAS"] = "1"

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.logging import logger
from app.db import connect_db, close_db
from app.api.routes import auth, users, face, state, anxiety, sessions, gamification, suggestions, analytics, ws, gestures, relief, journal

settings = get_settings()

# ── Rate limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

# ── Lifespan ──────────────────────────────────────────────────────────────────


from app.services.advanced_emotion_engine import advanced_emotion_engine
from app.services.gesture_engine import gesture_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await connect_db()
    # Pre-load advanced emotion & gesture engines
    advanced_emotion_engine.load_models()
    logger.info("Advanced emotion engine loaded")
    logger.info("Gesture engine ready")
    yield
    await close_db()
    logger.info("Shutdown complete")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Central Exception Handler ─────────────────────────────────────────────────


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": str(exc) if settings.DEBUG else None,
        },
    )


# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(face.router, prefix=settings.API_V1_PREFIX)
app.include_router(state.router, prefix=settings.API_V1_PREFIX)
app.include_router(anxiety.router, prefix=settings.API_V1_PREFIX)
app.include_router(sessions.router, prefix=settings.API_V1_PREFIX)
app.include_router(gamification.router, prefix=settings.API_V1_PREFIX)
app.include_router(suggestions.router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(gestures.router, prefix=settings.API_V1_PREFIX)
app.include_router(relief.router, prefix=settings.API_V1_PREFIX)
app.include_router(journal.router, prefix=settings.API_V1_PREFIX)
app.include_router(ws.router)


# ── Health Check ──────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}
