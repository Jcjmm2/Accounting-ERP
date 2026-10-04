# Modelo de datos contables

## 1. Propósito

El modelo contable debe representar las reglas básicas de la contabilidad financiera en Venezuela bajo NIIF PYMES y permitir la integración con el ERP existente.

## 2. Entidades principales

### 2.1 Empresa
```csharp
public class Empresa
{
    public int Id { get; set; }
    public string RazonSocial { get; set; }
    public string RIF { get; set; }
    public string TipoContribuyente { get; set; }
    public string MonedaBase { get; set; } = "USD";
    public string? LogoUrl { get; set; }
    public bool Activa { get; set; } = true;
    public int TenantId { get; set; }
}
```

### 2.2 PeriodoContable
```csharp
public class PeriodoContable
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public string Estado { get; set; } // Abierto, CierreParcial, Cerrado
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public DateTime? FechaCierre { get; set; }
    public string? Observaciones { get; set; }
}
```

### 2.3 CuentaContable
```csharp
public class CuentaContable
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public int? ParentId { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Tipo { get; set; } // Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo
    public string Naturaleza { get; set; } // Debe, Haber
    public string Categoria { get; set; } // Corriente, NoCorriente, Operativo, Financiero
    public int Nivel { get; set; }
    public bool EsMovimiento { get; set; }
    public bool Activa { get; set; } = true;
    public decimal SaldoInicial { get; set; }
    public DateTime? FechaCreacion { get; set; }
    public virtual CuentaContable? Parent { get; set; }
    public virtual ICollection<CuentaContable> Hijos { get; set; } = new List<CuentaContable>();
}
```

### 2.4 AsientoContable
```csharp
public class AsientoContable
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public int PeriodoContableId { get; set; }
    public int UsuarioId { get; set; }
    public string NumeroComprobante { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public string Tipo { get; set; } // Manual, Automatico, Ajuste, Cierre
    public string Concepto { get; set; } = string.Empty;
    public string Estado { get; set; } // Activo, Anulado
    public decimal TotalDebe { get; set; }
    public decimal TotalHaber { get; set; }
    public DateTime FechaCreacion { get; set; }
    public virtual ICollection<AsientoDetalle> Detalles { get; set; } = new List<AsientoDetalle>();
}
```

### 2.5 AsientoDetalle
```csharp
public class AsientoDetalle
{
    public int Id { get; set; }
    public int AsientoContableId { get; set; }
    public int CuentaContableId { get; set; }
    public decimal Debe { get; set; }
    public decimal Haber { get; set; }
    public string Glosa { get; set; } = string.Empty;
    public string? Referencia { get; set; }
    public virtual AsientoContable AsientoContable { get; set; }
    public virtual CuentaContable CuentaContable { get; set; }
}
```

### 2.6 Auditoria
```csharp
public class AuditoriaContable
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public int UsuarioId { get; set; }
    public string Entidad { get; set; }
    public int EntidadId { get; set; }
    public string Accion { get; set; }
    public string? Detalle { get; set; }
    public DateTime Fecha { get; set; }
}
```

## 3. Relaciones clave

- Una `Empresa` tiene muchos `PeriodoContable`.
- Un `PeriodoContable` contiene muchos `AsientoContable`.
- Un `AsientoContable` tiene muchos `AsientoDetalle`.
- Cada `AsientoDetalle` apunta a una `CuentaContable`.
- Cada `CuentaContable` puede tener muchos hijos y un único padre.
- Cada movimiento debe respetar que `Debe = Haber`.

## 4. Reglas de negocio 

### 4.1 Partida doble
La suma de débitos debe ser igual a la suma de créditos:

$$
\sum Debe = \sum Haber
$$

Si no se cumple, el asiento no debe persistirse.

### 4.2 Validación por periodo
No es posible registrar un asiento si el periodo está cerrado.

### 4.3 Validación del catálogo
- cuenta no debe estar inactiva,
- cuenta de movimiento no puede ser raíz,
- cuenta de naturaleza `Debe` o `Haber` debe respetar el flujo del asiento,
- un asiento de cierre puede asociarse solo a cuentas específicas.

### 4.4 Multi-empresa
Todo movimiento contable debe estar filtrado por `EmpresaId` y `TenantId`.

## 5. Relevancia para este proyecto

Este modelo se integra con la estructura actual del proyecto para no duplicar el dominio existente, sino complementarlo:

- `Usuario` ya existe como base de seguridad.
- `Empresa` ya existe como entidad base.
- `Venta`, `Compra`, `InventarioMovimiento` pueden producir asientos automáticos.
- `TytedContext` es el punto natural para registrar todas las entidades contables.

## 6. Migración recomendada

A nivel práctico, las entidades contables se agregan en fases:

1. `CuentaContable`
2. `PeriodoContable`
3. `AsientoContable`
4. `AsientoDetalle`
5. `AuditoriaContable`

## 7. Criterio de aceptación del módulo

Se considera listo cuando:
- se pueden registrar cuentas jerárquicas,
- generar comprobantes válidos,
- validar la partida doble,
- consultar libro mayor,
- generar balance de comprobación,
- y cerrar periodo con trazabilidad.
