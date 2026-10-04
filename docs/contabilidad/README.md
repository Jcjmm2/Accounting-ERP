# Módulo Contable - Arquitectura y Roadmap

## Objetivo

Definir una base técnica y de negocio para incorporar el módulo contable al ERP actual sin romper la arquitectura ya existente en ASP.NET Core + React + SQL Server.

Se recomienda tratar la contabilidad como un módulo independiente dentro del sistema, con su propio dominio, modelos, servicios y vistas, pero conectado a compras, ventas, inventario y usuarios existentes.

## Principios

- Separar la contabilidad del negocio operativo.
- Mantener `Partida Doble` como regla central.
- Aislar datos por empresa (`TenantId`) desde el inicio.
- Priorizar la base contable antes del fiscal tributario.
- Diseñar para auditoría, cierre y reportes.

## Documentación

- [Backlog priorizado](backlog-priorizado.md)
- [Modelo de datos contables](modelo-datos-contables.md)
- [Estructura de carpetas](estructura-carpetas.md)
- [Hoja de ruta real](hoja-de-ruta.md)

## Decisión estratégica

La implementación debe ir en este orden:

1. Base contable y plan de cuentas.
2. Asientos, comprobantes y periodos.
3. Reportes financieros básicos.
4. Integración con IVA/ISLR y módulos fiscales.
5. Auditoría, cierre y exportación.

## Alcance recomendado del proyecto

### Fase base
- Empresa, tenant, moneda base
- Plan de cuentas jerárquico
- Periodos contables
- Asientos y detalle
- Validación de partida doble
- Mayor y balance

### Fase intermedia
- Estado de resultados
- Estado de situación financiera
- Estado de cambios en patrimonio
- Flujo de efectivo
- Mapeo NIIF para reportes

### Fase avanzada
- IA de auditoría fiscal
- conciliación bancaria
- módulos IVA/ISLR
- exportación PDF/Excel
- cierre contable y control de calidad

---

La arquitectura y la ruta de trabajo están diseñadas para encajar con los archivos actuales del proyecto, especialmente [Tyted.API/Program.cs](../../Tyted.API/Program.cs), [Tyted.API/Models/Data/TytedContext.cs](../../Tyted.API/Models/Data/TytedContext.cs) y [Tyted.Frontend/src/App.jsx](../../Tyted.Frontend/src/App.jsx).
