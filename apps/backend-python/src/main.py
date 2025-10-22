from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.v1 import api_router
from src.config import settings
from src.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="DataNest API",
    version="0.3.0",
    description="Multi-tenant DataNest application with RAG capabilities",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "datanest-backend",
        "version": "0.3.0",
        "environment": settings.environment,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=True)
