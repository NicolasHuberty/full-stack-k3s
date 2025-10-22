# DataNest Backend (Python/FastAPI)

Modern Python backend with FastAPI, SQLAlchemy, and RAG capabilities using Python 3.14 and uv.

## Architecture

```
src/
├── models/          # SQLAlchemy ORM models
├── schemas/         # Pydantic validation schemas
├── repositories/    # Data access layer
├── services/        # Business logic layer
├── api/            # API routes and controllers
├── core/           # Core utilities (security, exceptions)
├── config.py       # Configuration management
├── database.py     # Database setup
└── main.py         # Application entry point
```

## Key Features

- **Clean Architecture**: Separation of concerns with repositories, services, and API layers
- **Type Safety**: Full typing with Pydantic and mypy
- **Async/Await**: Fully async with SQLAlchemy 2.0
- **Database Migrations**: Alembic for schema management
- **Testing**: Comprehensive pytest suite with >80% coverage
- **Code Quality**: Black, Ruff, and pre-commit hooks
- **RAG Support**: Qdrant vector search with sentence transformers
- **Authentication**: JWT with refresh tokens and Redis blacklisting
- **Python 3.14**: Latest Python with uv for fast dependency management

## Setup

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
make install

# Copy environment variables
cp .env.example .env

# Run database migrations
make migrate

# Start development server
make dev
```

## Development

```bash
# Run tests
make test

# Run tests with coverage
make test-cov

# Format code
make format

# Lint code
make lint

# Generate migration
make migrate-generate msg="your message"
```

## Docker

```bash
# Build and run with docker compose (recommended)
make docker-compose-up

# Stop and clean up
make docker-compose-down

# Or build image manually
make docker-build

# Run container
make docker-run
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc
- Health: http://localhost:8080/api/health

## Testing

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=src --cov-report=html

# Run specific test file
uv run pytest tests/test_auth.py
```

## Database Migrations

```bash
# Create new migration
uv run alembic revision --autogenerate -m "description"

# Apply migrations
uv run alembic upgrade head

# Rollback
uv run alembic downgrade -1
```

## Tech Stack

- **Python 3.14**: Latest Python release
- **uv**: Ultra-fast Python package manager
- **FastAPI**: Modern async web framework
- **SQLAlchemy 2.0**: Async ORM
- **Alembic**: Database migrations
- **Pydantic**: Data validation
- **Pytest**: Testing framework
- **Qdrant**: Vector database for RAG
- **Anthropic Claude**: AI integration
