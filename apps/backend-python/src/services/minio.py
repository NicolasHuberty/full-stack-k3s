import io

from minio import Minio

from src.config import settings


class MinioService:
    def __init__(self):
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.bucket = settings.minio_bucket
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload(self, object_name: str, data: bytes, content_type: str) -> None:
        self.client.put_object(
            self.bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    def download(self, object_name: str) -> bytes:
        response = self.client.get_object(self.bucket, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        return data

    def delete(self, object_name: str) -> None:
        self.client.remove_object(self.bucket, object_name)

    def get_presigned_url(self, object_name: str, expires: int = 3600) -> str:
        from datetime import timedelta

        return self.client.presigned_get_object(
            self.bucket, object_name, expires=timedelta(seconds=expires)
        )
