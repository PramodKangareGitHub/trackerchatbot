import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.admin import router as admin_router
from app.routes.chat import router as chat_router
from app.routes.datasets import router as datasets_router
from app.routes.pins import router as pins_router
from app.routes.auth import router as auth_router
from app.routes.customer_requirements import router as customer_requirements_router
from app.routes.hcl_demand import router as hcl_demand_router
from app.routes.interviewed_candidate_details import (
    router as interviewed_candidate_details_router,
)
from app.routes.hcl_onboarding_status import router as hcl_onboarding_router
from app.db import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.services.auth_utils import DEFAULT_ROLES, hash_password


def create_app() -> FastAPI:
    app = FastAPI(title="SmartChat Excel API")

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(datasets_router)
    app.include_router(chat_router)
    app.include_router(pins_router)
    app.include_router(admin_router)
    app.include_router(customer_requirements_router)
    app.include_router(hcl_demand_router)
    app.include_router(interviewed_candidate_details_router)
    app.include_router(hcl_onboarding_router)

    @app.on_event("startup")
    def seed_default_admin() -> None:
        """Create a default admin user if none exists yet."""
        email = os.getenv("DEFAULT_ADMIN_EMAIL")
        password = os.getenv("DEFAULT_ADMIN_PASSWORD")
        with SessionLocal() as db:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                return
            user = User(email=email, password_hash=hash_password(password), role="admin")
            db.add(user)
            db.commit()

    @app.on_event("startup")
    def seed_roles() -> None:
        """Ensure default roles exist for dynamic role validation."""
        with SessionLocal() as db:
            existing = {r.name for r in db.query(Role).all()}
            if "admin" not in existing:
                db.add(Role(name="admin"))
                db.commit()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
