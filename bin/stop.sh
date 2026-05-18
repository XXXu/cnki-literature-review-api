#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export PM2_APP_NAME="${PM2_APP_NAME:-cnki-literature-review-api}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "未找到 pm2，请先执行 npm install -g pm2" >&2
  exit 1
fi

if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
  pm2 stop "${PM2_APP_NAME}"
  pm2 save
  pm2 status "${PM2_APP_NAME}"
else
  echo "PM2 中没有找到应用：${PM2_APP_NAME}"
fi
