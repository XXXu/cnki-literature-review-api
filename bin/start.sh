#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export NODE_ENV="${NODE_ENV:-production}"
export LOG_FILE="${LOG_FILE:-logs/app.log}"
export PM2_APP_NAME="${PM2_APP_NAME:-cnki-literature-review-api}"

LOG_FILE_DIR="$(dirname "$LOG_FILE")"
mkdir -p "${LOG_FILE_DIR}"

if [ ! -f "dist/src/server.js" ]; then
  echo "dist/src/server.js 不存在，请先执行 npm run build" >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "未找到 pm2，请先执行 npm install -g pm2" >&2
  exit 1
fi

pm2 start dist/src/server.js \
  --name "${PM2_APP_NAME}" \
  --update-env

pm2 save
pm2 status "${PM2_APP_NAME}"
