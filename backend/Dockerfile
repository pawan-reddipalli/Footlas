FROM python:3.13-slim

WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
RUN pip install --no-cache-dir .

ENV ENVIRONMENT=production AUTH_MODE=clerk
EXPOSE 8000
# Apply migrations, then serve. Run `python -m app.seed` once after the first deploy.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
