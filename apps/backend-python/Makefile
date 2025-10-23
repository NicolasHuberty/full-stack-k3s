.PHONY: install dev test lint format clean migrate docker-build docker-run

install:
	uv sync

dev:
	uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8080

test:
	uv run pytest

test-cov:
	uv run pytest --cov=src --cov-report=html

lint:
	uv run ruff check src tests
	uv run mypy src

format:
	uv run black src tests
	uv run ruff check --fix src tests

migrate:
	uv run alembic upgrade head

migrate-generate:
	uv run alembic revision --autogenerate -m "$(msg)"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name '*.pyc' -delete
	find . -type f -name '*.pyo' -delete
	rm -rf .pytest_cache .mypy_cache .ruff_cache htmlcov .coverage

docker-build:
	docker build -t datanest-backend:latest .

docker-run:
	docker run -p 8080:8080 --env-file .env datanest-backend:latest

docker-compose-up:
	docker compose up --build -d

docker-compose-down:
	docker compose down -v
