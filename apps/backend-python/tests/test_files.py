import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_upload_file(client: AsyncClient, auth_headers):
    files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
    response = await client.post("/api/files/upload", files=files, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.txt"
    assert data["content_type"] == "text/plain"


@pytest.mark.asyncio
async def test_list_files(client: AsyncClient, auth_headers):
    files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
    await client.post("/api/files/upload", files=files, headers=auth_headers)

    response = await client.get("/api/files", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_download_file(client: AsyncClient, auth_headers):
    files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
    upload_response = await client.post("/api/files/upload", files=files, headers=auth_headers)
    file_id = upload_response.json()["id"]

    response = await client.get(f"/api/files/{file_id}/download", headers=auth_headers)
    assert response.status_code == 200
    assert response.content == b"test content"


@pytest.mark.asyncio
async def test_delete_file(client: AsyncClient, auth_headers):
    files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
    upload_response = await client.post("/api/files/upload", files=files, headers=auth_headers)
    file_id = upload_response.json()["id"]

    response = await client.delete(f"/api/files/{file_id}", headers=auth_headers)
    assert response.status_code == 200
