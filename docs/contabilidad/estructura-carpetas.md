# Estructura de carpetas recomendada

## Backend

```text
Tyted.API/
├── Controllers/
│   └── Contabilidad/
│       ├── CuentaContableController.cs
│       ├── AsientosController.cs
│       ├── PeriodosContablesController.cs
│       └── ReportesContablesController.cs
├── Models/
│   ├── Contabilidad/
│   │   ├── CuentaContable.cs
│   │   ├── AsientoContable.cs
│   │   ├── AsientoDetalle.cs
│   │   ├── PeriodoContable.cs
│   │   └── AuditoriaContable.cs
│   └── Data/
│       └── TytedContext.cs
├── DTOs/
│   └── Contabilidad/
│       ├── CrearAsientoDto.cs
│       ├── CuentaContableDto.cs
│       ├── PeriodoContableDto.cs
│       └── ReporteBalanceDto.cs
├── Services/
│   └── Contabilidad/
│       ├── PlanCuentasService.cs
│       ├── AsientoContableService.cs
│       ├── PeriodoContableService.cs
│       ├── ReportesContablesService.cs
│       └── MotorAsientosAutomaticos.cs
├── Data/
│   └── Configurations/
│       └── Contabilidad/
│           ├── CuentaContableConfiguration.cs
│           ├── AsientoContableConfiguration.cs
│           └── AsientoDetalleConfiguration.cs
└── Migrations/
```

## Frontend

```text
Tyted.Frontend/src/
├── pages/
│   └── contabilidad/
│       ├── PlanCuentas.jsx
│       ├── NuevoAsiento.jsx
│       ├── LibroMayor.jsx
│       ├── PeriodosContables.jsx
│       └── ReportesContables.jsx
├── components/
│   └── contabilidad/
│       ├── GrillaAsiento.jsx
│       ├── SelectorCuentas.jsx
│       ├── IndicadorPeriodo.jsx
│       └── BalanceComprobacionTable.jsx
├── services/
│   └── contabilidad/
│       └── contabilidadApi.js
├── hooks/
│   └── contabilidad/
│       ├── usePeriodoContable.js
│       ├── usePlanCuentas.js
│       └── useAsientos.js
├── Context/
│   └── AccountingContext.jsx
└── App.jsx
```

## Criterios de diseño

- Mantenerlo separado del dominio comercial actual.
- Usar `TytedContext` para centralizar entidades y relaciones.
- No mezclar la lógica de cuentas con la lógica de compras y ventas.
- Usar DTOs para aislamiento entre frontend y backend.
- Evitar lógica compleja dentro de los controladores.

## Nivel de integración con el proyecto actual

La integración debe ser gradual:

- `Program.cs`: registrar servicios y autenticación.
- `TytedContext`: agregar DbSet de contabilidad.
- `App.jsx`: agregar rutas de navegación del módulo contable.
- `ConfigContext`: ampliar con `periodoContable`, `empresa`, `monedaBase`.

## Entregables de la fase 1

- `Controllers/Contabilidad`
- `Models/Contabilidad`
- `Services/Contabilidad`
- `pages/contabilidad/PlanCuentas.jsx`
- `pages/contabilidad/NuevoAsiento.jsx`
- `services/contabilidad/contabilidadApi.js`
