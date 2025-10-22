from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import ConflictException, UnauthorizedException
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from src.models.user import User
from src.repositories.user import UserRepository
from src.schemas.user import AuthResponse, RegisterRequest
from src.services.redis import RedisService


class AuthService:
    def __init__(self, db: AsyncSession, redis: RedisService):
        self.repo = UserRepository(db)
        self.redis = redis

    async def register(self, data: RegisterRequest) -> AuthResponse:
        if await self.repo.get_by_email(data.email):
            raise ConflictException("Email already registered")
        if await self.repo.get_by_username(data.username):
            raise ConflictException("Username already taken")

        user = await self.repo.create(
            email=data.email, username=data.username, hashed_password=hash_password(data.password)
        )

        return await self._create_tokens(user)

    async def login(self, email: str, password: str) -> AuthResponse:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedException("Invalid credentials")

        return await self._create_tokens(user)

    async def refresh(self, refresh_token: str) -> AuthResponse:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise ValueError("Invalid token type")

            user_id = payload.get("sub")
            if not user_id:
                raise ValueError("Invalid token payload")

            is_blacklisted = await self.redis.exists(f"blacklist:refresh:{refresh_token}")
            if is_blacklisted:
                raise ValueError("Token has been revoked")

            user = await self.repo.get(user_id)
            if not user:
                raise ValueError("User not found")

            return await self._create_tokens(user)
        except Exception:
            raise UnauthorizedException("Invalid refresh token")

    async def logout(self, access_token: str, refresh_token: str) -> None:
        try:
            access_payload = decode_token(access_token)
            refresh_payload = decode_token(refresh_token)

            access_exp = access_payload.get("exp", 0)
            refresh_exp = refresh_payload.get("exp", 0)

            from datetime import datetime

            now = int(datetime.utcnow().timestamp())

            if access_exp > now:
                await self.redis.set(f"blacklist:access:{access_token}", "1", ex=access_exp - now)

            if refresh_exp > now:
                await self.redis.set(
                    f"blacklist:refresh:{refresh_token}", "1", ex=refresh_exp - now
                )
        except Exception:
            pass

    async def get_current_user(self, token: str) -> User:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if not user_id:
                raise ValueError("Invalid token")

            is_blacklisted = await self.redis.exists(f"blacklist:access:{token}")
            if is_blacklisted:
                raise UnauthorizedException("Token has been revoked")

            user = await self.repo.get(user_id)
            if not user:
                raise UnauthorizedException("User not found")

            return user
        except Exception:
            raise UnauthorizedException("Invalid authentication credentials")

    async def _create_tokens(self, user: User) -> AuthResponse:
        access_token = create_access_token(data={"sub": user.id})
        refresh_token = create_refresh_token(data={"sub": user.id})

        return AuthResponse(access_token=access_token, refresh_token=refresh_token)
