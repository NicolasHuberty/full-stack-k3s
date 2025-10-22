from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.models.file import File
from src.repositories.file import FileRepository
from src.services.minio import MinioService


class FileService:
    def __init__(self, db: AsyncSession, minio: MinioService):
        self.repo = FileRepository(db)
        self.minio = minio

    async def upload(self, user_id: str, filename: str, content: bytes, content_type: str) -> File:
        storage_path = f"{user_id}/{filename}"
        self.minio.upload(storage_path, content, content_type)

        return await self.repo.create(
            user_id=user_id,
            filename=filename,
            content_type=content_type,
            size=len(content),
            storage_path=storage_path,
        )

    async def get_by_id(self, file_id: str, user_id: str) -> File:
        file = await self.repo.get(file_id)
        if not file or file.user_id != user_id:
            raise NotFoundException("File not found")
        return file

    async def list_files(self, user_id: str, skip: int = 0, limit: int = 100) -> list[File]:
        return await self.repo.get_by_user(user_id, skip, limit)

    async def download(self, file_id: str, user_id: str) -> tuple[bytes, str, str]:
        file = await self.get_by_id(file_id, user_id)
        content = self.minio.download(file.storage_path)
        return content, file.filename, file.content_type

    async def delete(self, file_id: str, user_id: str) -> None:
        file = await self.get_by_id(file_id, user_id)
        self.minio.delete(file.storage_path)
        await self.repo.delete(file)

    async def update_transcription(self, file_id: str, transcription: str) -> File:
        file = await self.repo.get(file_id)
        if not file:
            raise NotFoundException("File not found")
        file.transcription = transcription
        return await self.repo.update(file)
