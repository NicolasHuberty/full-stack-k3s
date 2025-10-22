import redis.asyncio as redis

from src.config import settings


class RedisService:
    def __init__(self):
        self.client = redis.from_url(settings.redis_url, decode_responses=True)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        await self.client.set(key, value, ex=ex)

    async def get(self, key: str) -> str | None:
        return await self.client.get(key)

    async def delete(self, key: str) -> None:
        await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        return bool(await self.client.exists(key))

    async def close(self) -> None:
        await self.client.aclose()
