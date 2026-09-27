# Tyted Project

Sistema de gestión empresarial adaptada a la Economía en Venezuela Tasas de Cambio y Gestión de Productos en Economías Hiperinflacionarias, gestion de operaciones de compras, ventas, inventario, usuarios, reportes y control financiero.

## Tecnologías

- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- JWT para autenticación
- React + Vite (frontend)

## Requisitos

- .NET 10 SDK
- Node.js 18+
- SQL Server
- Git

## Configuración inicial

1. Clona el repositorio.
2. Configura la cadena de conexión en la aplicación API.
3. Configura la clave JWT para la API.
4. Restaura dependencias de la API y del frontend.

## API

### Configuración local

Crea o ajusta la configuración local de la API con variables de entorno o User Secrets.

Ejemplo con User Secrets:

```bash
dotnet user-secrets init

dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=YOUR_SERVER;Database=YOUR_DATABASE;Integrated Security=True;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:Key" "REPLACE_WITH_A_STRONG_SECRET_KEY_AT_LEAST_32_CHARACTERS_LONG"
```

Luego ejecuta:

```bash
cd Tyted.API
dotnet restore
dotnet build
dotnet run
```

## Frontend

```bash
cd Tyted.Frontend
npm install
npm run dev
```

## Estructura principal

- `Tyted.API/` - backend ASP.NET Core
- `Tyted.Frontend/` - frontend React
- `README.md` - documentación del proyecto

## Publicación en GitHub

1. Revisar que no existan secretos en el repositorio.
2. Confirmar que `bin`, `obj` y archivos locales no queden en el commit.
3. Crear un commit final.
4. Subir a GitHub.

```bash
git add .
git commit -m "Proyecto listo para publicacion"
git push origin main
```
