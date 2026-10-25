# Despliegue en Hetzner + Coolify — Runbook (Fase 4)

> Todo lo que sigue asume el stack `docker-compose.yml` de la raíz, **ya
> validado en local** (`docker compose up` en la PC de desarrollo: SPA + API +
> PostgreSQL 18 + backups, smoke test de login, 429 y cabeceras en verde).

## 1. Compra (lo único que falta)

| Ítem | Recomendación | Coste aprox. |
|---|---|---|
| Servidor | Hetzner Cloud **CPX21** (3 vCPU / 4 GB) — sube a CPX31 si esperas tráfico alto | ~€8/mes |
| Dominio | Cloudflare Registrar (al precio de costo) u otro registrador | ~€10–15/año |
| Coolify | **Community self-hosted = gratis** (se instala en tu servidor) | €0 |
| Cloudflare | Plan **Free** (DDoS + proxy DNS) | $0 |

Consigna SSH: genera clave en tu PC (`ssh-keygen -t ed25519`) y súbela a Hetzner.

## 2. Servidor base (los primeros 10 minutos)

1. Crear servidor con imagen **Ubuntu 24.04** (Hetzner Cloud).
2. **Firewall de Hetzner** (gratuito): abrir solo **22** (de preferencia restringido a tu IP), **80** y **443**. Nada más.
3. Entrar por SSH.

## 3. Instalar Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Al terminar abre `https://<IP-del-servidor>:8000`, crea la cuenta de administrador.
Coolify se encarga de Traefik (proxy TLS), certificados Let's Encrypt y despliegues.

## 4. DNS

- Registro **A** `@` → IP del servidor, **con el proxy de Cloudflare ACTIVADO** (nube naranja — ver `docs/SEGURIDAD.md`).
- (Opcional) `www` → CNAME al dominio raíz.

## 5. Recurso en Coolify

1. **New Resource → Public Git Repository** → `https://github.com/Jcjmm2/Accounting-ERP` (rama `main`).
2. Build pack: **Docker Compose** (usa el `docker-compose.yml` de la raíz).
3. **Environment Variables** (pestaña del servicio) — cópialas desde `.env.example` y genera valores nuevos:

| Variable | Valor |
|---|---|
| `POSTGRES_PASSWORD` | contraseña aleatoria larga (guárdala en tu gestor de contraseñas) |
| `JWT_KEY` | 48+ caracteres aleatorios |
| `APP_ORIGIN` | `https://tyted.net` |
| `ADMIN_SEED_PASSWORD` | password del admin que crea la semilla en el 1er arranque |
| `BACKUP_KEEP_DAYS` | `7` |
| `WEB_HOST_PORT` | `18080` — puerto host de `web` en el servidor (en local no se define y se usa `8080`; en el servidor evita el choque con el 8080 que ya ocupa `coolify-proxy`) |

> `ConnectionStrings__DefaultConnection` **NO** se define: el compose la arma
> a partir de `POSTGRES_PASSWORD`.

4. **Puertos expuestos**: solo el servicio **web → contenedor 8080**, dominio `tudominio.com`, TLS *Let's Encrypt*. **No exponer `api` ni `postgres`** (la red interna del compose ya lo garantiza).
5. **Deploy**.

## 6. Verificación post-deploy (smoke test E2E)

```bash
curl -s https://tudominio.com/health          # {"status":"ok"}
curl -sI https://tudominio.com/ | grep -iE 'strict-transport|x-frame|x-content'
```

- Abrir `https://tudominio.com/` → login con `ADMIN_SEED_PASSWORD` → token.
- Fuerza bruta: 12 logins con clave mala → debe aparecer **429**.
- Coolify → logs de `api`: sin errores (la migración `InitialPostgres` + seed corren solos en la primera petición).

## 7. Backups

- El contenedor **`backup`** hace `pg_dump` diario en `/backups` (volumen `backups`, retención `BACKUP_KEEP_DAYS`).
- **Descarga periódica fuera del servidor** (Coolify → snapshots, `scp`, o script): un backup en el mismo servidor no protege contra pérdida del servidor.
- Restore:

```bash
gunzip -c Tyted_20261022T000000Z.sql.gz | docker exec -i tyted-postgres-1 psql -U postgres -d Tyted
```

## 8. Operación diaria

- **Redeploy automático**: activa *Auto Deploy* en Coolify (cada `git push` a `main` despliega).
- Logs: UI de Coolify o `docker compose logs -f api` vía SSH.
- Estado: `docker compose ps` → `api` y `postgres` deben estar **healthy**.

## 9. Cierre de la fase

Smoke E2E completo sobre el dominio → **tag**:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

---

### Nota sobre `.env.example`

La regla `.env.*` del `.gitignore` lo ignora (el archivo quedó bloqueado por un
proceso al intentar añadir la excepción `!.env.example`). Para versionarlo:
cierra el editor que lo tenga abierto y ejecuta `git add -f .env.example`
(o añade la línea `!.env.example` tras `.env.*` en `.gitignore`).
Contenido mínimo también documentado en la tabla del paso 5.
