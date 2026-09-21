FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY demo-assets ./demo-assets
COPY alembic.ini .
COPY migrations ./migrations
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && if [ \"${DEMO_MODE:-false}\" = \"true\" ] || [ \"${DEMO_MODE:-false}\" = \"1\" ]; then python -c 'from app.demo_reset import reset_demo_state; reset_demo_state()'; fi && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
