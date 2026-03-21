#!/usr/bin/env bash
# =============================================================================
# SCORE Coaching — Автоматический бэкап PostgreSQL → MinIO
# =============================================================================
# Добавить в crontab (от deploy):
#   0 3 * * * /opt/score-coaching/infrastructure/scripts/backup.sh >> /var/log/score-backup.log 2>&1
# =============================================================================

set -euo pipefail

BACKUP_DIR="/tmp/score-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="score_backup_${TIMESTAMP}.dump.gz"

# Загрузить переменные
source /opt/score-coaching/.env

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Начинаю бэкап..."

# 1. Дамп PostgreSQL
docker compose -f /opt/score-coaching/docker-compose.yml exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-postgres}" \
            -d "${POSTGRES_DB:-postgres}" \
            --format=custom \
            --compress=9 \
    > "${BACKUP_DIR}/${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Дамп создан: ${BACKUP_FILE} (${BACKUP_SIZE})"

# 2. Загрузить в MinIO
docker compose -f /opt/score-coaching/docker-compose.yml run --rm \
    -v "${BACKUP_DIR}:/backups:ro" \
    minio-init sh -c "
        mc alias set score http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD};
        mc cp /backups/${BACKUP_FILE} score/backups/${BACKUP_FILE};
        echo 'Uploaded to MinIO: backups/${BACKUP_FILE}';
    "

# 3. Удалить старые локальные бэкапы
find "$BACKUP_DIR" -name "score_backup_*.dump.gz" -mtime +${RETENTION_DAYS} -delete

# 4. Удалить старые бэкапы из MinIO
docker compose -f /opt/score-coaching/docker-compose.yml run --rm \
    minio-init sh -c "
        mc alias set score http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD};
        mc find score/backups --older-than ${RETENTION_DAYS}d --exec 'mc rm {}';
    " 2>/dev/null || true

echo "[$(date)] Бэкап завершён успешно"
