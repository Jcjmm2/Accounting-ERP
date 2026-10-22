#!/bin/sh
# =========================================================================
# Backup diario de PostgreSQL para el stack docker-compose de Tyted.
# Corre en el contenedor 'backup' (imagen postgres:18-alpine, trae pg_dump).
#   - Genera /backups/<BD>_<fechaUTC>.sql.gz
#   - Borra los backups con más de BACKUP_KEEP_DAYS días (retención: 7 por defecto)
#   - Primer backup inmediatamente al arrancar y luego cada 24 h.
# =========================================================================
set -eu

: "${PGHOST:=postgres}"
: "${PGDATABASE:=Tyted}"
: "${BACKUP_KEEP_DAYS:=7}"

mkdir -p /backups
echo "[backup] Iniciado para ${PGHOST}/${PGDATABASE}. Retención: ${BACKUP_KEEP_DAYS} días."

while true; do
    archivo="/backups/${PGDATABASE}_$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

    if pg_dump --no-owner | gzip > "${archivo}"; then
        echo "[backup] OK: ${archivo} ($(du -h "${archivo}" | cut -f1))"
    else
        echo "[backup] ERROR: no se pudo generar ${archivo}" >&2
        rm -f "${archivo}"
    fi

    # Limpieza de backups vencidos (mtime en días)
    find /backups -name "${PGDATABASE}_*.sql.gz" -mtime "+${BACKUP_KEEP_DAYS}" -delete 2>/dev/null || true

    sleep 86400
done
