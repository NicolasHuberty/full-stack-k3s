from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8080

    database_url: str
    redis_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_bucket: str = "datanest"
    minio_secure: bool = False

    qdrant_url: str
    qdrant_collection: str = "datanest_documents"
    qdrant_vector_size: int = 384

    anthropic_api_key: str | None = None
    openai_api_key: str | None = None


settings = Settings()
