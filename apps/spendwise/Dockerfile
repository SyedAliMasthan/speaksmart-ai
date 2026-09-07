FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATABASE_PATH=/data/spendwise.sqlite3
WORKDIR /app
COPY requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock \
    && groupadd --gid 10001 spendwise \
    && useradd --uid 10001 --gid 10001 --no-create-home spendwise \
    && mkdir -p /data && chown spendwise:spendwise /data
COPY --chown=spendwise:spendwise app.py schema.sql ./
COPY --chown=spendwise:spendwise dist ./dist
COPY --chown=spendwise:spendwise scripts ./scripts
USER 10001:10001
EXPOSE 8000
CMD ["sh", "/app/scripts/start.sh"]
