FROM python:3.12-slim

WORKDIR /repo/apps/api

COPY . .
RUN pip install --no-cache-dir -e .

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
