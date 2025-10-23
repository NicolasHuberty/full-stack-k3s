from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_minio
from src.database import get_db
from src.schemas.file import FileResponse
from src.services.file import FileService
from src.services.minio import MinioService

router = APIRouter()


@router.post("/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    minio: MinioService = Depends(get_minio),
    current_user: CurrentUser = None,
):
    content = await file.read()
    service = FileService(db, minio)
    return await service.upload(
        current_user.id,
        file.filename or "unknown",
        content,
        file.content_type or "application/octet-stream",
    )


@router.get("", response_model=list[FileResponse])
async def list_files(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    minio: MinioService = Depends(get_minio),
    current_user: CurrentUser = None,
):
    service = FileService(db, minio)
    return await service.list_files(current_user.id, skip, limit)


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    minio: MinioService = Depends(get_minio),
    current_user: CurrentUser = None,
):
    service = FileService(db, minio)
    content, filename, content_type = await service.download(file_id, current_user.id)

    return StreamingResponse(
        iter([content]),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    minio: MinioService = Depends(get_minio),
    current_user: CurrentUser = None,
):
    service = FileService(db, minio)
    await service.delete(file_id, current_user.id)
    return {"message": "File deleted successfully"}
