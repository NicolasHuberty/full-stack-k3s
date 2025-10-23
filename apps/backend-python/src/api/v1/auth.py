from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_redis
from src.database import get_db
from src.schemas.user import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    UserResponse,
)
from src.services.auth import AuthService
from src.services.redis import RedisService

router = APIRouter()


@router.post("/register", response_model=AuthResponse)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    redis: RedisService = Depends(get_redis),
):
    service = AuthService(db, redis)
    return await service.register(data)


@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis: RedisService = Depends(get_redis),
):
    service = AuthService(db, redis)
    return await service.login(data.email, data.password)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis: RedisService = Depends(get_redis),
):
    service = AuthService(db, redis)
    return await service.refresh(data.refresh_token)


@router.post("/logout")
async def logout(
    authorization: str = Header(),
    db: AsyncSession = Depends(get_db),
    redis: RedisService = Depends(get_redis),
    current_user: CurrentUser = None,
):
    access_token = authorization.replace("Bearer ", "")
    service = AuthService(db, redis)
    await service.logout(access_token, "")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser):
    return current_user
