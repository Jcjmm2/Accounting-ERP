# Backlog priorizado del módulo contable

## Prioridad 0 - Base contable (requisito crítico)

### P0.1 - Configuración del tenant y datos base
- Crear estructura para `Empresa` con `TenantId` y soporte multimoneda.
- Definir moneda base por empresa.
- Parametrizar periodo fiscal y estado del periodo.

### P0.2 - Plan de cuentas jerárquico
- Entidad `CuentaContable` con relación padre/hijo.
- Código jerárquico por nivel.
- Validación de nivel 1 a 5 según estructura VEN-NIF.
- Seeding del plan base y reglas de uso por tipo de cuenta.

### P0.3 - Periodos contables
- Abrir, cerrar y bloquear periodos.
- Prevenir contabilizaciones en meses cerrados.
- Registrar auditoría de cierre.

### P0.4 - Asientos contables
- Cabecera `AsientoContable`.
- Detalle `AsientoDetalle`.
- Validación de partida doble.
- Control de diferencia Debe/Haber.
- Soporte de reverso y anulación.

### P0.5 - Libro mayor y balance de comprobación
- Consulta por cuenta y rango de fechas.
- Totales por cuenta y periodo.
- Balance de comprobación sumas y saldos.

## Prioridad 1 - Reportes financieros básicos

### P1.1 - Estado de resultados
- Ingresos operacionales.
- Otros ingresos.
- Costos y gastos.
- Resultado neto.

### P1.2 - Estado de situación financiera
- Activos corrientes/no corrientes.
- Pasivos corrientes/no corrientes.
- Patrimonio.
- Verificación de ecuación base.

### P1.3 - Estado de cambios en el patrimonio
- Capital social.
- Reservas.
- Ganancias retenidas.
- Resultado del periodo.

### P1.4 - Estado de flujo de efectivo
- Operación.
- Inversión.
- Financiamiento.
- Conciliación con efectivo final.

## Prioridad 2 - UX y operación contable

### P2.1 - Módulo frontend contable
- Vista de plan de cuentas
- Asientos manuales
- Libro mayor
- Cierre contable
- Resumen financiero

### P2.2 - Mapeo de rubros NIIF
- Relación de cuenta contable con rubro financiero.
- Soporte para reportes y exportación.

### P2.3 - Exportación PDF/Excel
- Reportes contables en PDF.
- Exportación a Excel con formatos formales.

## Prioridad 3 - Integración con negocio operacional

### P3.1 - Generación automática de asientos
- Desde compras
- Desde ventas
- Desde inventario
- Desde cuentas por cobrar/pagar

### P3.2 - Integración con caja y pagos
- Conciliación de efectivo y bancos.
- Asientos de cobranza y pago.

### P3.3 - Control de auditoría y trazabilidad
- Logs por usuario y fecha.
- Historial de cambios.
- Identificación de movimientos anulados.

## Prioridad 4 - Fiscal y complementarios

### P4.1 - IVA / ISLR / IGTF
- Motor tributario y relaciones contables.
- Archivos SENIAT.

### P4.2 - Reexpresión por inflación
- Ajustes por INPC.
- EEFF reexpresados.

### P4.3 - Depreciación y activos fijos
- Amortización financiera y fiscal.

### P4.4 - Auditoría fiscal y salud fiscal
- Reglas automáticas de validación.
- Diagnóstico pre-cierre.

## Riesgo y criterio de salida

Se considera entregado un hito cuando:
- se puede crear cuentas y jerarquías,
- registrar asientos validos,
- verificar la partida doble,
- generar mayor y balance,
- consultar el estado financiero básico,
- y se logra auditoría mínima por usuario y fecha.

## Backlog recomendado para sprint 1

1. `CuentaContable` + migración.
2. `PeriodoContable` + estados.
3. `AsientoContable` + `AsientoDetalle`.
4. Validación de saldo total Debe/Haber.
5. endpoint `GET /api/contabilidad/cuentas`.
6. endpoint `POST /api/contabilidad/asientos`.
7. formulario de asiento manual.
8. libro mayor simple.
9. balance de comprobación.

---

Este backlog está alineado con la base actual del repositorio, especialmente con la estructura y capas ya existentes en [Tyted.API/Program.cs](../../Tyted.API/Program.cs) y en [Tyted.Frontend/src/App.jsx](../../Tyted.Frontend/src/App.jsx).
