
from functools import lru_cache

from app.infrastructure.wialon.session import WialonSessionManager
from app.services.vehicle_cache import AsyncTTLCache
from app.api.v1.schemas.vehicle import VehicleResponse


@lru_cache
def get_wialon_session_manager() -> WialonSessionManager:
    return WialonSessionManager()


@lru_cache
def get_vehicle_cache() -> AsyncTTLCache[list[VehicleResponse]]:
    return AsyncTTLCache(ttl_seconds=20)
