#!/bin/bash

# Start LUCID Finance Backend API

echo "Starting LUCID Finance Backend API..."
echo "=========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start MySQL Docker container if not running
if ! docker ps | grep -q lucid_finance_db; then
    echo "Starting MySQL database..."
    docker compose up -d
    echo "Waiting for MySQL to be ready..."
    sleep 5
fi

# Start FastAPI server
echo "Starting FastAPI server on http://localhost:8000"
uv run uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000
