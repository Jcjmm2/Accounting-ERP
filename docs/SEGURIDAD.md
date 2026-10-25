# Seguridad — medidas implementadas + checklist Cloudflare

## A. Implementado y VERIFICADO con smoke test local (22/10/2026)

### Borde — nginx (contenedor `web`)
| Medida | Detalle | Verificación |
|---|---|---|
| Rate limiting L7 | `limit_req` 10 r/s por IP, `burst=30` → responde **429** | ✓ |
| Límite de conexiones | `limit_conn` 50 simultáneas por IP → 429 | ✓ |
| Tamaño de cuerpo | `client_max_body_size 2m` → 413 si se excede | ✓ |
| Cabeceras de seguridad | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, **HSTS** | ✓ (las 5 presentes) |
| Huella del servidor | `server_tokens off` | ✓ |
| IP real | `real_ip` con redes privadas + `include cf-realip.conf` (Cloudflare) | ✓ |

### Aplicación — API
| Medida | Detalle | Verificación |
|---|---|---|
| Rate limiting global | **600 req/min por cliente** (partición por `X-Real-IP`) → 429 JSON | ✓ |
| Rate limiting de login | política `login`: **10 intentos/min** → 429 | ✓ (`401×9 → 429×3`) |
| Bloqueo de cuenta | `LoginBloqueo`: 10 fallos consecutivos → **bloqueo 15 min** (además del límite por IP) | ✓ |
| Manejo de errores | `ErrorHandlerMiddleware` registrado; en producción responde **mensaje genérico** (el detalle solo al log) | ✓ |
| Límite Kestrel | `MaxRequestBodySize = 2 MB` | ✓ |
| Healthcheck | `/health` (también vía nginx) | ✓ |
| Previos (Fase 1) | CORS con orígenes explícitos · JWT `ClockSkew=0` y clave ≥32 · Scalar/OpenAPI solo en Development · secretos fuera de git | ✓ |

### Infraestructura
- **Solo `web` publica puertos** (`8080`). `api`, `postgres` y `backup` en red interna — comprobado con `docker ps` (ningún puerto host).
- Contenedores como **usuario no root** (`USER $APP_UID` en la API, `USER nginx` en web).
- Secretos solo por **variables de entorno** (Coolify / `.env` local en `.gitignore`).
- Backup diario `pg_dump` con retención configurable **+ copia off-site diaria a Cloudflare R2** (rclone desde el propio contenedor `backup`; credenciales solo en variables de entorno; poda remota `S3_KEEP_DAYS`).

## B. Checklist Cloudflare Free (el día que apuntes el DNS)

1. Cuenta gratis en **cloudflare.com** → añadir dominio → nameservers de CF en el registrador.
2. Registro **A** `@` → IP de Hetzner con **proxy ACTIVADO (nube naranja)**.
   → **Clave anti ataques masivos**: oculta la IP de origen. Sin esto, un
   atacante ignora Cloudflare y ataca la IP directa. El DDoS de Hetzner cubre
   L3/L4, pero Cloudflare añade mitigación L7 + WAF + bots.
3. **SSL/TLS → Overview → Full (strict)** (Coolify ya termina el TLS con Let's Encrypt; CF valida con su certificado).
4. **Always Use HTTPS** → ON.
5. **Security → Bots → Bot Fight Mode** → ON.
6. **Security → WAF** → activar las reglas gratuitas disponibles en tu plan.
7. *(Opcional, cupo gratis)* Rate limiting rules en CF como segunda capa.
8. **Tras activar el proxy**: completar `Tyted.Frontend/cf-realip.conf` con la
   lista oficial de rangos (<https://www.cloudflare.com/ips/>) y hacer
   redeploy — así el rate limit de nginx/API usa la IP del **visitante** y no
   la del borde de Cloudflare.
9. *(Futuro v1.x)* **Turnstile** (CAPTCHA invisible gratis) en el login si el
   rate limiting no bastara.

## C. Firewalls del servidor

- **Hetzner Cloud Firewall** (gratuito): permitir 22 (de tu IP), 80, 443.
- Hetzner: protección DDoS de red **incluida** (capa L3/4).

## D. Roadmap de seguridad (no bloqueante para v1)

1. **CSP estricta** en nginx — pendiente de validar flows con blob:/cámara/pdf (jspdf, html5-qrcode) para no romper la SPA.
2. Turnstile en login.
3. WAF self-hosted (ModSecurity + OWASP CRS) solo si llega a hacer falta — complejo de mantener.
4. Monitoreo de uptime (p. ej. Uptime Kuma self-hosted) + alertas.
5. `dotnet list package --vulnerable` / `npm audit` en cada release.
