#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

OUTFILE="$BACKUP_DIR/dropi_${TIMESTAMP}.sql"
pg_dump "$DATABASE_URL" > "$OUTFILE"
gzip "$OUTFILE"
echo "Backup saved to ${OUTFILE}.gz"
