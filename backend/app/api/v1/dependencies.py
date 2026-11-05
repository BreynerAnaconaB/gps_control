from functools import lru_cache

from app.infrastructure.wialon.session import WialonSessionManager


@lru_cache
def get_wialon_session_manager() -> WialonSessionManager:
    return WialonSessionManager()