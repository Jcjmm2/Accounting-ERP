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

## 7. Backups (local + off-site en Cloudflare R2)

- El contenedor **`backup`** (imagen `docker/backup`: postgres:18-alpine + **rclone**) hace `pg_dump` diario en `/backups` (volumen `backups`, retención `BACKUP_KEEP_DAYS`) **y lo sube a Cloudflare R2** → `r2:tyted-backups/postgres/` (retención remota `S3_KEEP_DAYS`, 30 días por defecto).
- Credenciales S3 (variables del servicio en Coolify / `.env` local): `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Si faltan, el backup **sigue funcionando solo en local** (el log lo avisa).
- Verificación: dashboard Cloudflare → R2 → bucket `tyted-backups` debe contener el `.sql.gz` del día. O con rclone: `rclone lsf r2:tyted-backups/postgres/`.
- Un dump en el mismo servidor no protege contra su pérdida → R2 es la copia que sobrevive. Cuota gratis 10 GB; la poda `S3_KEEP_DAYS` evita agotarla.
- Restore **local** (volumen `backups`):

```bash
gunzip -c Tyted_20261022T000000Z.sql.gz | docker exec -i tyted-postgres-1 psql -U postgres -d Tyted
```

- Restore **desde R2** (máquina nueva o pérdida total del servidor):

```bash
rclone copy r2:tyted-backups/postgres/Tyted_<fecha>.sql.gz .   # o descargarlo desde el dashboard R2
gunzip -c Tyted_<fecha>.sql.gz | docker exec -i tyted-postgres-1 psql -U postgres -d Tyted
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

## 10. Acceso de emergencia (incidente 25/10/2026 — lecciones)

**Diseño actual de acceso** (post-incidente):
- SSH `22/tcp` **abierto desde cualquier IP pero SOLO con claves** (`PasswordAuthentication no`; claves: `id_ed25519_tyted` en la PC de desarrollo y `id_ed25519` local, ambas en `/root/.ssh/authorized_keys`). → La rotación de IP **nunca** vuelve a bloquear el SSH.
- Firewall del host en `/etc/iptables/rules.v4` (persistencia: `netfilter-persistent save`). El panel Coolify (`:8000`) y la terminal (`6001/6002`) quedan **restringidos a la IP pública actual**.
- **Si tu IP rota** y no puedes abrir Coolify: abre un túnel SSH → `ssh -i <clave> -L 8000:localhost:8000 root@<IP>` y entra a `http://localhost:8000`.
- Contraseña root: **solo para la consola web de Hetzner** (guardar en el gestor; nunca en el repo). Se regenera desde el servidor en Hetzner → pestaña **Rescue** → **Reset Root Password**.

**Reglas de la consola web (VNC) de Hetzner** (verificado empíricamente):
- **Nunca pegar bloques largos**: el pegado corrompe los caracteres `>`, `&` y `_` (y los returns).
- Un comando = una línea = un Enter. Para guiones bajos usar **TAB** (autocompletado); para espacios dentro de `sed`, comillas simples (funcionan) o el `.` como comodín **solo en el patrón** (jamás en el reemplazo: ese fue el bug que paró sshd).
- Sí sobreviven al pegado: letras/mayúsculas, espacios, `.`, `/`, `-`, comillas simples.

---

## 11. Incidente 25/10/2026 (tarde) — login 500 (28P01) por colisión de DNS interno

**Síntoma**: login en producción → `{"message":"Se produjo un error interno en el servidor...","status":500}`.
Recordar: un password incorrecto devuelve **401**; el **500** = excepción (causa real solo en los logs del `api`).

**Causa raíz**: en la red `coolify` (compartida entre el stack de Coolify y las apps), el
hostname `postgres` resolvía a **dos** contenedores: el postgres del app **y `coolify-db`**
(el servicio interno de Coolify también se llama `postgres`). Npgsql se conectaba al que
respondía primero → `28P01` del servidor equivocado → la semilla fallaba en cada arranque.

**Solución aplicada**:
1. Runtime: `docker network disconnect coolify <api>` y `<backup>` (no necesitan esa red;
   el proxy solo habla con `web`) + reinicio del `api`.
2. Permanente: el SERVICIO se renombró `postgres` → **`tyted-db`** (Coolify ignora los
   aliases de red del compose pero SÍ registra el nombre de servicio en todas las redes
   a las que conecta cada contenedor) + `Host=tyted-db` / `PGHOST=tyted-db`.
   El volumen `pgdata` no cambia: los datos se conservan.
3. Bonus: `backup.sh` ya no usa `pg_dump | gzip` (gzip enmascaraba fallos de pg_dump y
   subía dumps vacíos); ahora volcado a temporal + verificación de tamaño.

**Lecciones**:
- `/health` es estático: NO prueba la BD. Sirve solo como "proceso vivo".
- Coolify comparte su red con las apps: **evita nombres genéricos** (`postgres`, `db`,
  `redis`) como host de conexión; usa un alias exclusivo del stack.
- El acceso por SSH (`id_ed25519_tyted`) permite diagnóstico directo:
  `docker logs <api> --tail 50`, `docker exec <pg> psql -U postgres -d Tyted`.

---

### Nota sobre `.env.example`

La regla `.env.*` del `.gitignore` lo ignora (el archivo quedó bloqueado por un
proceso al intentar añadir la excepción `!.env.example`). Para versionarlo:
cierra el editor que lo tenga abierto y ejecuta `git add -f .env.example`
(o añade la línea `!.env.example` tras `.env.*` en `.gitignore`).
Contenido mínimo también documentado en la tabla del paso 5.
