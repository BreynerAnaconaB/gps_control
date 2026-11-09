import asyncio
import logging
from time import monotonic
from typing import Awaitable, Callable, Generic, TypeVar

logger = logging.getLogger(__name__)
T = TypeVar("T")


class AsyncTTLCache(Generic[T]):
    """
    Cache asincrono con soporte para Stale-While-Revalidate (SWR) y Double-Checked Locking.
    (Bonus Seccion 12: Cache SWR para consultas a Wialon).
    """

    def __init__(self, ttl_seconds: int = 20, stale_ttl_seconds: int = 60):
        self.ttl_seconds = ttl_seconds
        self.stale_ttl_seconds = stale_ttl_seconds
        self._data: T | None = None
        self._expires_at = 0.0
        self._stale_until = 0.0
        self._lock = asyncio.Lock()
        self._is_revalidating = False

    async def _revalidate(self, loader: Callable[[], Awaitable[T]]) -> None:
        """Tarea en segundo plano para revalidar datos stale."""
        if self._is_revalidating:
            return
        async with self._lock:
            self._is_revalidating = True
            try:
                data = await loader()
                now = monotonic()
                self._data = data
                self._expires_at = now + self.ttl_seconds
                self._stale_until = now + self.ttl_seconds + self.stale_ttl_seconds
            except Exception as exc:
                logger.warning("Fallo en revalidacion en background (SWR): %s", exc)
            finally:
                self._is_revalidating = False

    async def get_or_load(
        self,
        loader: Callable[[], Awaitable[T]],
    ) -> T:
        now = monotonic()

        # 1. Datos totalmente frescos
        if self._data is not None and now < self._expires_at:
            return self._data

        # 2. Estrategia Stale-While-Revalidate: servir dato stale inmediatamente y revalidar en background
        if self._data is not None and now < self._stale_until:
            if not self._is_revalidating:
                asyncio.create_task(self._revalidate(loader))
            return self._data

        # 3. Cache vacia o totalmente vencida: carga bloqueante con Double-Checked Locking
        async with self._lock:
            now = monotonic()

            if self._data is not None and now < self._expires_at:
                return self._data

            data = await loader()
            now = monotonic()
            self._data = data
            self._expires_at = now + self.ttl_seconds
            self._stale_until = now + self.ttl_seconds + self.stale_ttl_seconds

            return data

    async def invalidate(self) -> None:
        async with self._lock:
            self._data = None
            self._expires_at = 0.0
            self._stale_until = 0.0
