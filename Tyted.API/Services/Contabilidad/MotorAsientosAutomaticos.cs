using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

/// <summary>
/// Mapping de cuentas VEN-NIF para la integración administrativo-contable
/// (generación automática de asientos de ventas y compras, plan BE-F4).
/// Se configura en appsettings.json → sección "Contabilidad:Mapping";
/// los valores por defecto corresponden al plan base del sistema.
/// </summary>
public class MappingContable
{
    public string Caja { get; set; } = "1.1.1.1.01";
    public string CuentasPorCobrar { get; set; } = "1.1.3.01";
    public string IvaDebitoFiscal { get; set; } = "1.1.5.01";
    public string IvaCreditoFiscal { get; set; } = "1.1.5.02";
    public string IngresosVentas { get; set; } = "4.1.1";
    public string Compras { get; set; } = "5.1.1";
    public string Gastos { get; set; } = "5.1.2";
    public string Proveedores { get; set; } = "2.1.1.01";
}

/// <summary>Respuesta del motor de asientos automáticos.</summary>
public class MotorAsientosResponse
{
    public bool Generada { get; set; }
    public int AsientoId { get; set; }
    public string NumeroComprobante { get; set; } = string.Empty;
    public decimal TotalDebe { get; set; }
    public decimal TotalHaber { get; set; }
    public string Mensaje { get; set; } = string.Empty;
    /// <summary>Aviso no bloqueante (p. ej. cuentas faltantes en el plan).</summary>
    public string? Advertencia { get; set; }
}

/// <summary>
/// Motor de asientos automáticos: convierte ventas y compras registradas en
/// comprobantes de diario (partida doble) contra el plan de cuentas de la
/// empresa, reutilizando AsientoContableService (valida periodo abierto,
/// rango de fechas, comprobante consecutivo y auditoría).
/// El periodo se busca por la FECHA de la operación (debe existir un periodo
/// ABIERTO que la contenga). Si el plan no tiene las cuentas del mapping se
/// responde con ADVERTENCIA (Generada=false) sin romper el registro. La
/// idempotencia la da AsientoContableId: nunca se duplica el comprobante.
/// </summary>
public class MotorAsientosAutomaticos
{
    private readonly TytedContext _context;
    private readonly AsientoContableService _asientos;
    private readonly MappingContable _mapping;

    public MotorAsientosAutomaticos(TytedContext context, AsientoContableService asientos, MappingContable mapping)
    {
        _context = context;
        _asientos = asientos;
        _mapping = mapping;
    }

    /// <summary>
    /// Comprobante de la VENTA (criterio BE-TAX-401): Debe Caja (contado) o
    /// Cuentas por Cobrar (crédito) por el TOTAL; Haber Ingresos por Ventas
    /// (base) + IVA Débito Fiscal. Partida doble garantizada.
    /// </summary>
    public async Task<MotorAsientosResponse> GenerarAsientoVentaAsync(Venta venta, int usuarioId = 1)
    {
        if (venta.AsientoContableId.HasValue)
            return new MotorAsientosResponse
            {
                Generada = false,
                AsientoId = venta.AsientoContableId.Value,
                Mensaje = "La venta ya tiene comprobante contable.",
                Advertencia = $"Ya contabilizada (asiento {venta.AsientoContableId.Value}): no se duplica el comprobante."
            };

        if (venta.IsAnulada)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Venta anulada.",
                Advertencia = "Las ventas anuladas no se contabilizan."
            };

        var detalles = venta.Detalles != null && venta.Detalles.Any()
            ? venta.Detalles.ToList()
            : await _context.VentasDetalle.Where(d => d.VentaId == venta.VentaId).ToListAsync();

        var subtotal = venta.SubtotalMonedaBase != 0m
            ? venta.SubtotalMonedaBase
            : detalles.Sum(d => d.SubtotalLineaMonedaBase);
        var iva = venta.IvaMonedaBase;
        var total = subtotal + iva;

        if (Math.Abs(total) <= 0.005m)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Sin montos que contabilizar.",
                Advertencia = "La venta no tiene montos."
            };

        // Nota de crédito / anulación (monto negativo): se invierten los lados
        // del asiento para conservar la partida doble con montos positivos.
        var esNotaCredito = total < 0m;
        var montoTotal = Math.Abs(total);
        var montoBase = Math.Abs(subtotal);
        var montoIva = Math.Abs(iva);

        var codigoDebe = venta.EsCredito ? _mapping.CuentasPorCobrar : _mapping.Caja;
        var faltantes = new List<string>();
        var cuentaDebe = await BuscarCuentaActivaAsync(venta.EmpresaId, codigoDebe, faltantes);
        var cuentaIngresos = await BuscarCuentaActivaAsync(venta.EmpresaId, _mapping.IngresosVentas, faltantes);
        var cuentaIva = montoIva > 0m
            ? await BuscarCuentaActivaAsync(venta.EmpresaId, _mapping.IvaDebitoFiscal, faltantes)
            : null;

        if (faltantes.Count > 0)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Plan de cuentas incompleto.",
                Advertencia = $"No se encontraron activas en el plan de la empresa: {string.Join(", ", faltantes)}. Cree o reactive las cuentas y vuelva a intentar."
            };

        var periodo = await BuscarPeriodoAbiertoAsync(venta.EmpresaId, venta.FechaVenta);

        var lineas = new List<AsientoDetalle>();
        if (!esNotaCredito)
        {
            // Venta normal: Debe Caja/CxC (total) | Haber Ingresos + IVA Débito
            lineas.Add(new AsientoDetalle { CuentaContableId = cuentaDebe!.Id, Debe = montoTotal, Haber = 0m });
            if (montoBase > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaIngresos!.Id, Debe = 0m, Haber = montoBase });
            if (montoIva > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaIva!.Id, Debe = 0m, Haber = montoIva });
        }
        else
        {
            // Nota de crédito / anulación: lados invertidos (partida doble)
            if (montoBase > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaIngresos!.Id, Debe = montoBase, Haber = 0m });
            if (montoIva > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaIva!.Id, Debe = montoIva, Haber = 0m });
            lineas.Add(new AsientoDetalle { CuentaContableId = cuentaDebe!.Id, Debe = 0m, Haber = montoTotal });
        }

        var etiquetaVenta = esNotaCredito ? "NOTA DE CRÉDITO/ANULACIÓN VENTA" : "VENTA";
        var concepto = $"{etiquetaVenta} {venta.NumeroFactura} [{venta.TipoTransaccion}] total {montoTotal:0.00}";
        var asiento = await _asientos.CrearAsientoAsync(new AsientoContable
        {
            EmpresaId = venta.EmpresaId,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = string.Empty,
            FechaComprobante = venta.FechaVenta,
            Concepto = concepto.Length > 500 ? concepto[..500] : concepto,
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = usuarioId,
            Detalles = lineas
        });

        // Vínculo venta ↔ comprobante (base de la idempotencia)
        venta.AsientoContableId = asiento.Id;
        await _context.SaveChangesAsync();

        return new MotorAsientosResponse
        {
            Generada = true,
            AsientoId = asiento.Id,
            NumeroComprobante = asiento.NumeroComprobante,
            TotalDebe = montoTotal,
            TotalHaber = montoTotal,
            Mensaje = esNotaCredito
                ? "Comprobante contable de la nota de crédito/anulación generado."
                : "Comprobante contable de la venta generado."
        };
    }

    /// <summary>
    /// Comprobante de la COMPRA (criterio BE-TAX-402): Debe Compras (o Gastos
    /// si es servicio) por la base + IVA Crédito Fiscal (1.1.5.x); Haber
    /// Proveedores (crédito) o Caja (contado) por el TOTAL.
    /// </summary>
    public async Task<MotorAsientosResponse> GenerarAsientoCompraAsync(Compra compra, int usuarioId = 1)
    {
        if (compra.AsientoContableId.HasValue)
            return new MotorAsientosResponse
            {
                Generada = false,
                AsientoId = compra.AsientoContableId.Value,
                Mensaje = "La compra ya tiene comprobante contable.",
                Advertencia = $"Ya contabilizada (asiento {compra.AsientoContableId.Value}): no se duplica el comprobante."
            };

        if (compra.IsAnulada)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Compra anulada.",
                Advertencia = "Las compras anuladas no se contabilizan."
            };

        var subtotal = compra.SubtotalMonedaBase;
        var iva = compra.IvaMonedaBase;
        var total = subtotal + iva;

        if (Math.Abs(total) <= 0.005m)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Sin montos que contabilizar.",
                Advertencia = "La compra no tiene montos."
            };

        // Nota de crédito / anulación (monto negativo): se invierten los lados
        // del asiento para conservar la partida doble con montos positivos.
        var esNotaCredito = total < 0m;
        var montoTotal = Math.Abs(total);
        var montoBase = Math.Abs(subtotal);
        var montoIva = Math.Abs(iva);

        var codigoDebe = compra.EsGastoServicio ? _mapping.Gastos : _mapping.Compras;
        var codigoHaber = compra.EsCredito ? _mapping.Proveedores : _mapping.Caja;
        var faltantes = new List<string>();
        var cuentaDebe = await BuscarCuentaActivaAsync(compra.EmpresaId, codigoDebe, faltantes);
        var cuentaHaber = await BuscarCuentaActivaAsync(compra.EmpresaId, codigoHaber, faltantes);
        var cuentaIva = montoIva > 0m
            ? await BuscarCuentaActivaAsync(compra.EmpresaId, _mapping.IvaCreditoFiscal, faltantes)
            : null;

        if (faltantes.Count > 0)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Plan de cuentas incompleto.",
                Advertencia = $"No se encontraron activas en el plan de la empresa: {string.Join(", ", faltantes)}. Cree o reactive las cuentas y vuelva a intentar."
            };

        var periodo = await BuscarPeriodoAbiertoAsync(compra.EmpresaId, compra.FechaCompra);

        var lineas = new List<AsientoDetalle>();
        if (!esNotaCredito)
        {
            // Compra normal: Debe Compras (base) + IVA Crédito | Haber Proveedor/Caja (total)
            if (montoBase > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaDebe!.Id, Debe = montoBase, Haber = 0m });
            if (montoIva > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaIva!.Id, Debe = montoIva, Haber = 0m });
            lineas.Add(new AsientoDetalle { CuentaContableId = cuentaHaber!.Id, Debe = 0m, Haber = montoTotal });
        }
        else
        {
            // Nota de crédito de compra: lados invertidos (partida doble)
            if (montoBase > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaDebe!.Id, Debe = 0m, Haber = montoBase });
            if (montoIva > 0m)
                lineas.Add(new AsientoDetalle { CuentaContableId = cuentaIva!.Id, Debe = 0m, Haber = montoIva });
            lineas.Add(new AsientoDetalle { CuentaContableId = cuentaHaber!.Id, Debe = montoTotal, Haber = 0m });
        }

        var numero = string.IsNullOrWhiteSpace(compra.NumeroFactura) ? "(s/n)" : compra.NumeroFactura;
        var etiquetaCompra = esNotaCredito ? "NOTA DE CRÉDITO/ANULACIÓN COMPRA" : "COMPRA";
        var concepto = $"{etiquetaCompra} {numero} control {compra.NumeroControl ?? "-"} total {montoTotal:0.00}";
        var asiento = await _asientos.CrearAsientoAsync(new AsientoContable
        {
            EmpresaId = compra.EmpresaId,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = string.Empty,
            FechaComprobante = compra.FechaCompra,
            Concepto = concepto.Length > 500 ? concepto[..500] : concepto,
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = usuarioId,
            Detalles = lineas
        });

        // Vínculo compra ↔ comprobante (base de la idempotencia)
        compra.AsientoContableId = asiento.Id;
        await _context.SaveChangesAsync();

        return new MotorAsientosResponse
        {
            Generada = true,
            AsientoId = asiento.Id,
            NumeroComprobante = asiento.NumeroComprobante,
            TotalDebe = montoTotal,
            TotalHaber = montoTotal,
            Mensaje = esNotaCredito
                ? "Comprobante contable de la nota de crédito/anulación de compra generado."
                : "Comprobante contable de la compra generado."
        };
    }

    /// <summary>
    /// Comprobante del GASTO fiscal: Debe Gastos (5.1.2) | Haber Proveedores
    /// (si tiene proveedor) o Caja. Idempotencia por AsientoContableId.
    /// </summary>
    public async Task<MotorAsientosResponse> GenerarAsientoGastoAsync(Gasto gasto, int usuarioId = 1)
    {
        if (gasto.AsientoContableId.HasValue)
            return new MotorAsientosResponse
            {
                Generada = false,
                AsientoId = gasto.AsientoContableId.Value,
                Mensaje = "El gasto ya tiene comprobante contable.",
                Advertencia = $"Ya contabilizado (asiento {gasto.AsientoContableId.Value}): no se duplica el comprobante."
            };

        if (gasto.IsAnulada)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Gasto anulado.",
                Advertencia = "Los gastos anulados no se contabilizan."
            };

        var monto = Math.Abs(gasto.Monto);
        if (monto <= 0.005m)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Sin monto que contabilizar.",
                Advertencia = "El gasto no tiene monto."
            };

        var codigoHaber = gasto.CodigoProv.HasValue ? _mapping.Proveedores : _mapping.Caja;
        var faltantes = new List<string>();
        var cuentaDebe = await BuscarCuentaActivaAsync(gasto.EmpresaId, _mapping.Gastos, faltantes);
        var cuentaHaber = await BuscarCuentaActivaAsync(gasto.EmpresaId, codigoHaber, faltantes);

        if (faltantes.Count > 0)
            return new MotorAsientosResponse
            {
                Generada = false,
                Mensaje = "Plan de cuentas incompleto.",
                Advertencia = $"No se encontraron activas en el plan de la empresa: {string.Join(", ", faltantes)}. Cree o reactive las cuentas y vuelva a intentar."
            };

        var periodo = await BuscarPeriodoAbiertoAsync(gasto.EmpresaId, gasto.Fecha);

        var concepto = $"GASTO [{gasto.TipoTransaccion}] {gasto.Categoria ?? "S/CAT"} {gasto.Concepto} total {monto:0.00}";
        var asiento = await _asientos.CrearAsientoAsync(new AsientoContable
        {
            EmpresaId = gasto.EmpresaId,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = string.Empty,
            FechaComprobante = gasto.Fecha,
            Concepto = concepto.Length > 500 ? concepto[..500] : concepto,
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = usuarioId,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = cuentaDebe!.Id, Debe = monto, Haber = 0m },
                new() { CuentaContableId = cuentaHaber!.Id, Debe = 0m, Haber = monto }
            }
        });

        // Vínculo gasto ↔ comprobante (idempotencia)
        gasto.AsientoContableId = asiento.Id;
        await _context.SaveChangesAsync();

        return new MotorAsientosResponse
        {
            Generada = true,
            AsientoId = asiento.Id,
            NumeroComprobante = asiento.NumeroComprobante,
            TotalDebe = monto,
            TotalHaber = monto,
            Mensaje = "Comprobante contable del gasto generado."
        };
    }

    /// <summary>Cuenta activa por código dentro del plan de la empresa; si no existe se anota en `faltantes`.</summary>
    private async Task<CuentaContable?> BuscarCuentaActivaAsync(int empresaId, string codigo, List<string> faltantes)
    {
        var cuenta = await _context.CuentasContables
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.EmpresaId == empresaId
                && c.CodigoCuenta == codigo
                && c.Activa);

        if (cuenta == null && !faltantes.Contains(codigo))
            faltantes.Add(codigo);
        return cuenta;
    }

    /// <summary>
    /// Periodo ABIERTO de la empresa que contiene la fecha de la operación.
    /// Sin periodo no se contabiliza (lanza InvalidOperationException → HTTP 400).
    /// </summary>
    private async Task<PeriodoContable> BuscarPeriodoAbiertoAsync(int empresaId, DateTime fecha)
    {
        var dia = fecha.Date;
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.EmpresaId == empresaId
                && p.FechaInicio.Date <= dia
                && p.FechaFin.Date >= dia
                && !p.Cerrado
                && p.Estado != "Cerrado");

        return periodo ?? throw new InvalidOperationException(
            $"No hay un periodo contable ABIERTO de la empresa {empresaId} que contenga la fecha {dia:dd/MM/yyyy}. Cree o abra el periodo antes de contabilizar.");
    }
}