from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.file import File
from src.repositories.base import BaseRepository


class FileRepository(BaseRepository[File]):
    def __init__(self, db: AsyncSession):
        super().__init__(File, db)

    async def get_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> list[File]:
        result = await self.db.execute(
            select(File).where(File.user_id == user_id).offset(skip).limit(limit)
        )
        return list(result.scalars().all())
