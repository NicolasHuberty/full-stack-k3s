from datetime import datetime

from pydantic import BaseModel


class FileResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    transcription: str | None
    created_at: datetime

    class Config:
        from_attributes = True
