
import asyncio
from time import monotonic
from typing import Awaitable, Callable, Generic, TypeVar

T = TypeVar("T")


class AsyncTTLCache(Generic[T]):
    def __init__(self, ttl_seconds: int = 20):
        self.ttl_seconds = ttl_seconds
        self._data: T | None = None
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    async def get_or_load(
        self,
        loader: Callable[[], Awaitable[T]],
    ) -> T:
        now = monotonic()

        if self._data is not None and now < self._expires_at:
            return self._data

        async with self._lock:
            now = monotonic()

            # Otra petición pudo actualizar la caché mientras esperábamos.
            if self._data is not None and now < self._expires_at:
                return self._data

            # Solo guardamos datos si la consulta termina correctamente.
            data = await loader()

            self._data = data
            self._expires_at = monotonic() + self.ttl_seconds

            return data

    async def invalidate(self) -> None:
        async with self._lock:
            self._data = None
            self._expires_at = 0.0
