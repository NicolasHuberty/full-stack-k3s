from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import UnauthorizedException
from src.database import get_db
from src.models.user import User
from src.services.auth import AuthService
from src.services.minio import MinioService
from src.services.qdrant import QdrantService
from src.services.redis import RedisService


async def get_redis() -> RedisService:
    return RedisService()


def get_minio() -> MinioService:
    return MinioService()


def get_qdrant() -> QdrantService:
    return QdrantService()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
    redis: RedisService = Depends(get_redis),
) -> User:
    if not authorization:
        raise UnauthorizedException("Missing authorization header")

    if not authorization.startswith("Bearer "):
        raise UnauthorizedException("Invalid authorization header")

    token = authorization.replace("Bearer ", "")
    auth_service = AuthService(db, redis)
    return await auth_service.get_current_user(token)


CurrentUser = Annotated[User, Depends(get_current_user)]
