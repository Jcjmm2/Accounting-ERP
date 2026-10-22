# syntax=docker/dockerfile:1
# =========================================================================
# Imagen de producción del frontend Tyted (multi-stage).
# Etapa 1: build de Vite (React) con Node.
# Etapa 2: nginx (usuario NO root) sirviendo estáticos + proxy /api.
# =========================================================================

FROM node:22-alpine AS build
WORKDIR /app

# Dependencias primero (capa cacheada)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS final

# nginx.conf completo (main + http + server) pensado para correr sin root:
# pid y temporales en /tmp, escucha en 8080, proxy a api:8080, rate limiting
# y cabeceras de seguridad.
COPY nginx.conf /etc/nginx/nginx.conf
# Se elimina el default del image: los scripts de entrypoint del image operan
# sobre él y fallarían como usuario no root si no está vacío/ausente.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
COPY cf-realip.conf /etc/nginx/cf-realip.conf

USER nginx
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
