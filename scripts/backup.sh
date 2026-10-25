#!/bin/sh
# =========================================================================
# Backup diario de PostgreSQL para el stack docker-compose de Tyted.
# Corre en el contenedor 'backup' (imagen docker/backup: pg_dump + rclone).
#   - Genera /backups/<BD>_<fechaUTC>.sql.gz
#   - Si S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY están definidos,
#     sube cada dump a r2:<S3_BUCKET>/postgres/ (Cloudflare R2) con
#     reintentos y purga allí los objetos con más de S3_KEEP_DAYS días.
#     Si faltan credenciales, el backup sigue funcionando SOLO en local.
#   - Borra los backups locales con más de BACKUP_KEEP_DAYS días (7 por defecto).
#   - Si BACKUP_PUSH_URL está definido (monitor Push de Uptime Kuma), envía
#     un ping tras cada ciclo completo OK → si no llega en 25 h, alerta.
#   - Primer backup inmediatamente al arrancar y luego cada 24 h.
# =========================================================================
set -eu

: "${PGHOST:=postgres}"
: "${PGDATABASE:=Tyted}"
: "${BACKUP_KEEP_DAYS:=7}"
: "${S3_KEEP_DAYS:=30}"
: "${S3_BUCKET:=tyted-backups}"
: "${S3_REGION:=auto}"

mkdir -p /backups
echo "[backup] Iniciado para ${PGHOST}/${PGDATABASE}. Retención local: ${BACKUP_KEEP_DAYS} días."

# --- Remoto rclone para Cloudflare R2 (config por variables de entorno) ---
R2_ON=0
if [ -n "${S3_ENDPOINT:-}" ] && [ -n "${S3_ACCESS_KEY_ID:-}" ] && [ -n "${S3_SECRET_ACCESS_KEY:-}" ]; then
    R2_ON=1
    export RCLONE_CONFIG_R2_TYPE=s3
    export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
    export RCLONE_CONFIG_R2_ENDPOINT="${S3_ENDPOINT}"
    export RCLONE_CONFIG_R2_REGION="${S3_REGION}"
    export RCLONE_CONFIG_R2_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
    export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"
    # Token con permisos por objeto: sin HeadBucket (evita 401/403 en R2)
    export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
    echo "[backup] Off-site habilitado → r2:${S3_BUCKET}/postgres/ (poda remota: ${S3_KEEP_DAYS} días)."
else
    echo "[backup] Aviso: faltan credenciales S3 (S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY); los backups serán SOLO locales." >&2
fi

while true; do
    archivo="/backups/${PGDATABASE}_$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
    ok_ciclo=1

    if pg_dump --no-owner | gzip > "${archivo}"; then
        echo "[backup] OK: ${archivo} ($(du -h "${archivo}" | cut -f1))"
    else
        echo "[backup] ERROR: no se pudo generar ${archivo}" >&2
        rm -f "${archivo}"
        ok_ciclo=0
    fi

    # --- Subida off-site a Cloudflare R2 --------------------------------
    if [ "${ok_ciclo}" = 1 ] && [ "${R2_ON}" = 1 ]; then
        destino="r2:${S3_BUCKET}/postgres/$(basename "${archivo}")"
        if rclone copyto "${archivo}" "${destino}" --retries 3 --low-level-retries 5; then
            echo "[backup] R2 OK: ${destino}"
            # Poda de objetos remotos vencidos (S3_KEEP_DAYS; 0 = no podar)
            if [ "${S3_KEEP_DAYS}" -gt 0 ] 2>/dev/null; then
                rclone delete "r2:${S3_BUCKET}/postgres/" --min-age "${S3_KEEP_DAYS}d" \
                    || echo "[backup] Aviso: no se pudo podar en R2" >&2
            fi
        else
            echo "[backup] R2 ERROR: fallo al subir $(basename "${archivo}"); el dump local queda conservado." >&2
            ok_ciclo=0
        fi
    fi

    # Limpieza de backups locales vencidos (mtime en días)
    find /backups -name "${PGDATABASE}_*.sql.gz" -mtime "+${BACKUP_KEEP_DAYS}" -delete 2>/dev/null || true

    # Heartbeat a Uptime Kuma solo si TODO el ciclo salió bien
    if [ "${ok_ciclo}" = 1 ] && [ -n "${BACKUP_PUSH_URL:-}" ]; then
        wget -q -O /dev/null "${BACKUP_PUSH_URL}" 2>/dev/null \
            || echo "[backup] Aviso: no se pudo enviar el ping de estado (Uptime Kuma)" >&2
    fi

    sleep 86400
done
