from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.domains.football.router import router as football_router
from app.domains.gameplay.router import router as gameplay_router
from app.domains.gameplay.service import GameError
from app.domains.users.router import router as users_router

settings = get_settings()
app = FastAPI(title="Footlas API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(GameError)
def game_error(_: Request, exc: GameError) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=exc.status_code)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


for router in (football_router, gameplay_router, users_router):
    app.include_router(router, prefix="/api")
