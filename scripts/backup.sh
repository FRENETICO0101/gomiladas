#!/usr/bin/env bash
set -euo pipefail

# Backup server/data into backups/ with timestamp, prune backups older than 14 days
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
DATA_DIR="$ROOT_DIR/server/data"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="$BACKUP_DIR/data-$TIMESTAMP.tar.gz"

if [ ! -d "$DATA_DIR" ]; then
  echo "Data directory not found: $DATA_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

tar -czf "$ARCHIVE" -C "$DATA_DIR" .

echo "Backup created: $ARCHIVE"

# prune older than 14 days
find "$BACKUP_DIR" -type f -name 'data-*.tar.gz' -mtime +14 -print -delete || true
