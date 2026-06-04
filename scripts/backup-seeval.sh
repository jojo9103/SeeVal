#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${SEEV_BACKUP_DIR:-$ROOT_DIR/backups}"
UPLOAD_DIR="${SEEV_UPLOAD_DIR:-$ROOT_DIR/.seeval-uploads/projects}"
RETENTION_DAYS="${SEEV_BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d_%H%M%S)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for database backup." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

pg_dump "$DATABASE_URL" > "$BACKUP_DIR/seeval_db_$STAMP.sql"

if [[ -d "$UPLOAD_DIR" ]]; then
  tar -czf "$BACKUP_DIR/seeval_uploads_$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
fi

find "$BACKUP_DIR" -type f \( -name "seeval_db_*.sql" -o -name "seeval_uploads_*.tar.gz" \) -mtime +"$RETENTION_DAYS" -delete

echo "Backup completed: $BACKUP_DIR"
