"""
Seed script: creates the initial Admin user and default roles/permissions.

Usage:
    cd backend
    python -m scripts.seed_admin

Reads ADMIN_EMAIL and ADMIN_PASSWORD from the .env file.
Idempotent: safe to run multiple times.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Make sure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.infrastructure.database.base import AsyncSessionLocal, engine
from app.infrastructure.database.models import Base, Permission, Role, RoleName, User

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Permission matrix — single source of truth (SEG-01, RF-05, 5.3)
# ---------------------------------------------------------------------------
# Format: (role, action, resource)

PERMISSIONS: list[tuple[RoleName, str, str]] = [
    # ---- Admin ----
    (RoleName.admin, "read",   "vehicles"),
    (RoleName.admin, "write",  "vehicles"),
    (RoleName.admin, "read",   "drivers"),
    (RoleName.admin, "write",  "drivers"),
    (RoleName.admin, "read",   "passengers"),
    (RoleName.admin, "write",  "passengers"),
    (RoleName.admin, "read",   "history"),
    (RoleName.admin, "export", "data"),
    (RoleName.admin, "read",   "audit"),
    (RoleName.admin, "manage", "users"),
    # ---- Operator ----
    (RoleName.operator, "read",   "vehicles"),
    (RoleName.operator, "write",  "vehicles"),
    (RoleName.operator, "read",   "drivers"),
    (RoleName.operator, "write",  "drivers"),
    (RoleName.operator, "read",   "passengers"),
    (RoleName.operator, "write",  "passengers"),
    (RoleName.operator, "read",   "history"),
    (RoleName.operator, "export", "data"),
    # ---- Viewer ----
    (RoleName.viewer, "read", "vehicles"),
    (RoleName.viewer, "read", "drivers"),
    (RoleName.viewer, "read", "passengers"),
    (RoleName.viewer, "read", "history"),
]


async def seed(db: AsyncSession) -> None:
    # 1. Create roles
    role_map: dict[RoleName, Role] = {}

    for role_name in RoleName:
        result = await db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()

        if role is None:
            role = Role(name=role_name)
            db.add(role)
            await db.flush()
            logger.info("Created role: %s", role_name)
        else:
            logger.info("Role already exists: %s", role_name)

        role_map[role_name] = role

    # 2. Create permissions (idempotent)
    for role_name, action, resource in PERMISSIONS:
        role = role_map[role_name]

        result = await db.execute(
            select(Permission).where(
                Permission.role_id == role.id,
                Permission.action == action,
                Permission.resource == resource,
            )
        )
        perm = result.scalar_one_or_none()

        if perm is None:
            db.add(Permission(role_id=role.id, action=action, resource=resource))
            logger.info("  Permission added: %s -> %s:%s", role_name, action, resource)

    # 3. Create Admin user
    admin_email = getattr(settings, "ADMIN_EMAIL", None)
    admin_password = getattr(settings, "ADMIN_PASSWORD", None)

    if not admin_email or not admin_password:
        logger.warning(
            "ADMIN_EMAIL or ADMIN_PASSWORD not set in .env — skipping admin user creation"
        )
    else:
        result = await db.execute(
            select(User).where(User.email == admin_email.lower().strip())
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            admin_role = role_map[RoleName.admin]
            admin_user = User(
                email=admin_email.lower().strip(),
                password_hash=hash_password(admin_password),
                role_id=admin_role.id,
                is_active=True,
                must_change_password=False,
            )
            db.add(admin_user)
            logger.info("Created admin user: %s", admin_email)
        else:
            existing.password_hash = hash_password(admin_password)
            existing.is_active = True
            logger.info("Admin user password synchronized with environment: %s", admin_email)

    await db.commit()
    logger.info("Seed completed successfully.")


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified.")

    async with AsyncSessionLocal() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())

