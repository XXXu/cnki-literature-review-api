#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export NODE_ENV="${NODE_ENV:-production}"
export LOG_FILE="${LOG_FILE:-logs/app.log}"

LOG_FILE_DIR="$(dirname "$LOG_FILE")"
mkdir -p "${LOG_FILE_DIR}"

if [ ! -f "dist/src/server.js" ]; then
  echo "dist/src/server.js 不存在，请先执行 npm run build" >&2
  exit 1
fi

exec node dist/src/server.js
