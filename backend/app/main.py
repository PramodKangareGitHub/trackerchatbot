from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.admin import router as admin_router
from app.routes.chat import router as chat_router
from app.routes.datasets import router as datasets_router
from app.routes.pins import router as pins_router


def create_app() -> FastAPI:
    app = FastAPI(title="SmartChat Excel API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(datasets_router)
    app.include_router(chat_router)
    app.include_router(pins_router)
    app.include_router(admin_router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
