# Hoja de ruta real del proyecto

## Fase 0 - Diagnóstico y preparación (Semana 1)

### Objetivos
- Revisar la arquitectura actual y preparar el dominio contable.
- Verificar el modelo de `Empresa`, `Usuario`, `TytedContext` y JWT.
- Identificar puntos de integración con ventas, compras e inventario.

### Entregables
- Modelo de contabilidad aprobado.
- Definición de `TenantId` y `EmpresaId`.
- Plan de cuentas base sugerido.
- Matriz de integraciones con módulos existentes.

### Criterio de cierre
- Se tiene una base clara para crear el módulo sin afectar el negocio operativo.

---

## Fase 1 - Base contable (Semanas 2-4)

### Objetivos
- Crear el catálogo de cuentas.
- Crear periodos contables.
- Registrar asientos y validaciones.

### Entregables
- `CuentaContable` con jerarquía padre/hijo.
- `PeriodoContable` con estados.
- `AsientoContable` y `AsientoDetalle`.
- validación de partida doble.
- API base para crear y consultar cuentas y asientos.

### Criterio de cierre
- Se puede abrir un periodo, crear cuentas, registrar asientos válidos y consultar libro mayor.

---

## Fase 2 - Reportes financieros (Semanas 5-7)

### Objetivos
- Generar saldos por cuenta.
- Construir balance de comprobación.
- Generar estados financieros básicos.

### Entregables
- `ReportesContablesService`
- endpoints de mayor, balance y EEFF básicos
- vistas frontend para consultar reportes

### Criterio de cierre
- El sistema entrega estado de resultados y balance en formato útil para decisión gerencial.

---

## Fase 3 - UX y automatización (Semanas 8-10)

### Objetivos
- Mejorar la operación del módulo contable.
- Integrar asientos automáticos desde ventas/compras.
- Reforzar la experiencia de usuario.

### Entregables
- formulario de asientos manuales
- selector de cuentas con búsqueda
- cálculo en tiempo real de totais
- motor de asientos automáticos

### Criterio de cierre
- El usuario puede registrar el flujo contable sin intervención técnica.

---

## Fase 4 - Auditoría, cierre y exportación (Semanas 11-13)

### Objetivos
- Registrar trazabilidad y cierre.
- Exportar a PDF/Excel.
- Preparar el sistema para reportes oficiales.

### Entregables
- `AuditoriaContable`
- cierre de periodo
- PDF y Excel de reportes
- logs y validaciones de auditoría

### Criterio de cierre
- El cierre contable queda documentado y auditable.

---

## Fase 5 - Integración fiscal y expansión (Semanas 14+)

### Objetivos
- Añadir tributario y módulos complementarios.
- Conectar IVA, ISLR, BCV y conciliación bancaria.

### Entregables
- módulos fiscales avanzados
- reportes con reflejo tributario
- exportación SENIAT/XML
- diagnósticos de salud fiscal

### Criterio de cierre
- El sistema evidencia cumplimiento fiscal y respaldo contable.

---

## Recomendación de entrega inicial

La primera entrega real debe ser:

1. `CuentaContable`
2. `PeriodoContable`
3. `AsientoContable`
4. `AsientoDetalle`
5. `Book Mayor`
6. `Balance de comprobación`
7. `Formulario de asientos`
8. `Reporte financiero básico`

Esto entrega valor real y mantiene a la plataforma estable y clara.

## Riesgo de saltarse esta secuencia

Si se pretende avanzar directamente a fiscal/tributario sin la base contable, el proyecto tendrá:
- inconsistencias entre saldos,
- dificultad para auditoría,
- errores de integridad,
- y un enorme costo de corrección.

---

La hoja de ruta prioriza resultados útiles y verificables antes de ampliar el alcance tributario, respetando la estructura actual del repositorio en [Tyted.API](../../Tyted.API) y [Tyted.Frontend](../../Tyted.Frontend).
