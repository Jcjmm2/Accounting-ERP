# syntax=docker/dockerfile:1
# =========================================================================
# Imagen del contenedor 'backup' de Tyted.
#   - Base postgres:18-alpine → trae pg_dump (misma versión que la BD).
#   - + rclone (repo community de Alpine) → sube cada dump a Cloudflare R2
#     (API S3 compatible). R2 exige rclone ≥ 1.59; los paquetes actuales
#     de Alpine cumplen holgadamente.
# El entrypoint lo fija el compose: /bin/sh /backup.sh (scripts/backup.sh).
# =========================================================================
FROM postgres:18-alpine

RUN apk add --no-cache rclone
