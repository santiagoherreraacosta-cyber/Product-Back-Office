#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"
OUTPUT="$BACKUP_DIR/db-$(date -u +%Y%m%dT%H%M%SZ).dump"

pg_dump "$DATABASE_URL" --format=custom --file="$OUTPUT"
sha256sum "$OUTPUT" > "$OUTPUT.sha256"
echo "Backup written to $OUTPUT"
