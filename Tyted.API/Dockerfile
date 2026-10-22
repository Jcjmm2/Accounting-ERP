# syntax=docker/dockerfile:1
# =========================================================================
# Imagen de producción de la API Tyted (multi-stage).
# Etapa 1: restore cacheado + publish en Release.
# Etapa 2: runtime aspnet como usuario NO root escuchando en 8080.
# =========================================================================

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore primero (capa cacheada: solo se repite si cambia el .csproj)
COPY Tyted.API.csproj ./
RUN dotnet restore Tyted.API.csproj

# Código completo y publicación
COPY . ./
RUN dotnet publish Tyted.API.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# curl solo para el healthcheck del orquestador (compose/Coolify)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

# Usuario no root (imágenes .NET 8+ definen APP_UID=1654)
USER $APP_UID

ENTRYPOINT ["dotnet", "Tyted.API.dll"]
