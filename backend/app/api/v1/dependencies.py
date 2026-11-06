
"""
FastAPI dependency injection.

Provides:
  - get_db: async DB session per request
  - get_wialon_session_manager: singleton Wialon session
  - get_vehicle_cache: singleton TTL cache
  - get_current_user: extracts and validates the Bearer JWT
  - require_permission: factory that creates a dependency checking RBAC
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.infrastructure.database.base import get_db
from app.infrastructure.database.models import User
from app.infrastructure.wialon.session import WialonSessionManager
from app.services.vehicle_cache import AsyncTTLCache
from app.api.v1.schemas.vehicle import VehicleResponse

# Re-export get_db so endpoints can import from one place
__all__ = [
    "get_db",
    "get_wialon_session_manager",
    "get_wialon_gateway",
    "get_vehicle_cache",
    "get_current_user",
    "require_permission",
]

# ---------------------------------------------------------------------------
# Wialon singletons
# ---------------------------------------------------------------------------


@lru_cache
def get_wialon_session_manager() -> WialonSessionManager:
    return WialonSessionManager()


def get_wialon_gateway(
    session_manager: WialonSessionManager = Depends(get_wialon_session_manager),
):
    from app.infrastructure.wialon.gateway import WialonGateway

    return WialonGateway(session_manager)


@lru_cache
def get_vehicle_cache() -> AsyncTTLCache[list[VehicleResponse]]:
    return AsyncTTLCache(ttl_seconds=20)


# ---------------------------------------------------------------------------
# Auth: current user
# ---------------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extracts the Bearer JWT from the Authorization header, decodes it,
    and returns the authenticated User from the DB.

    Raises HTTP 401 on any authentication failure.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autenticado")

    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token malformado")

    from app.services.auth_service import AuthService

    service = AuthService(db)
    user = await service.get_user_by_id(int(user_id))

    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")

    return user


# ---------------------------------------------------------------------------
# RBAC: permission guard
# ---------------------------------------------------------------------------


def require_permission(action: str, resource: str):
    """
    Dependency factory. Returns a FastAPI dependency that checks whether the
    authenticated user's role has the given (action, resource) permission.

    Usage in an endpoint:
        @router.post("/drivers", dependencies=[Depends(require_permission("create", "drivers"))])

    Design: permissions are stored in DB (not hardcoded), so adding a new role
    or adjusting a permission requires only a DB change, not a code deploy.
    """

    async def _check(
        current_user: User = Depends(get_current_user),
    ) -> User:
        allowed = any(
            p.action == action and p.resource == resource
            for p in current_user.role.permissions
        )

        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=f"No tienes permiso para '{action}' en '{resource}'",
            )

        return current_user

    return _check
