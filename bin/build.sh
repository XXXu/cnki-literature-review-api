#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请先安装 Node.js" >&2
  exit 1
fi

if [ ! -d "node_modules" ] || [ ! -x "node_modules/.bin/tsc" ] || [ ! -x "node_modules/.bin/prisma" ]; then
  if [ -f "package-lock.json" ]; then
    npm ci --ignore-scripts
  else
    npm install --ignore-scripts
  fi
fi

echo "编译脚本不会执行数据库迁移，不会运行 prisma migrate 或 prisma db push"
npm run prisma:generate
npm run build

if [ ! -f "dist/src/server.js" ]; then
  echo "编译失败：dist/src/server.js 不存在" >&2
  exit 1
fi

echo "编译完成：dist/src/server.js"
