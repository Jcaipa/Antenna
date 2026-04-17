#!/bin/bash
# Arranca el backend — sólo vigila archivos del proyecto, no el venv
cd "$(dirname "$0")"
source venv/bin/activate

uvicorn main:app \
  --reload \
  --reload-dir routers \
  --reload-dir . \
  --reload-exclude "venv" \
  --reload-exclude "venv/*" \
  --host 0.0.0.0 \
  --port 8000
