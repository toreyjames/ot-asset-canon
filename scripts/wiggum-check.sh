#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[wiggum] running build health check..."
npm ci
npm run build

echo "[wiggum] build health check passed"
