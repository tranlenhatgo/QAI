"""AI Study Coach — FastAPI entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from server.config import settings
from server.routes import chat, health, generate, solve
from server.ws.endpoint import ws_handler

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Paths that don't require API key authentication
PUBLIC_PATHS = {"/", "/health", "/docs", "/redoc", "/openapi.json"}
PUBLIC_PREFIXES = ("/static/",)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info(f"🚀 {settings.app_name} starting...")
    logger.info(f"   Quiz API: {settings.quiz_api_url}")

    # Check LLM: LM Studio
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.lm_studio_url.rstrip('/')}/v1/models")
            if resp.status_code == 200:
                data = resp.json()
                models = data.get("data", [])
                model_names = [m.get("id", "?") for m in models]
                logger.info(f"   ✅ LM Studio available — models: {', '.join(model_names) or 'none'}")
    except Exception:
        logger.warning(f"   ⚠️ LM Studio not running at {settings.lm_studio_url}")

    # API key security status
    if settings.api_key:
        logger.info("   🔒 API key authentication ENABLED")
    else:
        logger.warning("   ⚠️ API key not set — endpoints are OPEN (set COACH_API_KEY to secure)")

    yield
    logger.info(f"👋 {settings.app_name} shutting down")


app = FastAPI(
    title=settings.app_name,
    description="AI-powered study coach that analyzes quiz performance and creates personalized study plans.",
    version="0.1.0",
    lifespan=lifespan,
)


# ─── API Key Middleware ──────────────────────────────────────────────────────


@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    """
    Verify X-API-Key header on protected endpoints.

    - If COACH_API_KEY is not set: all endpoints are open (dev mode).
    - If COACH_API_KEY is set: /chat and /chat/agentic require the header.
    - Public paths (/, /health, /docs, /static) are always open.
    - WebSocket upgrades are checked separately in the WS handler.
    """
    # Skip if no API key configured (dev mode)
    if not settings.api_key:
        return await call_next(request)

    # Allow public paths
    path = request.url.path
    if path in PUBLIC_PATHS or any(path.startswith(p) for p in PUBLIC_PREFIXES):
        return await call_next(request)

    # Allow CORS preflight (OPTIONS)
    if request.method == "OPTIONS":
        return await call_next(request)

    # Skip WebSocket upgrades (handled in the WS endpoint via query param)
    if request.headers.get("upgrade", "").lower() == "websocket":
        return await call_next(request)

    # Check API key
    api_key = request.headers.get("X-API-Key", "")
    if api_key != settings.api_key:
        logger.warning(f"🔒 Rejected request to {path} — invalid or missing API key")
        return JSONResponse(
            status_code=401,
            content={"error": "Invalid or missing API key. Set X-API-Key header."},
        )

    return await call_next(request)


# CORS — allow quiz app frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(chat.router, tags=["Chat"])
app.include_router(health.router, tags=["Health"])
app.include_router(generate.router, tags=["Generation"])
app.include_router(solve.router, tags=["Solve"])


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_handler(websocket)


# Serve widget static files
app.mount("/static", StaticFiles(directory="widget"), name="static")


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
    }

