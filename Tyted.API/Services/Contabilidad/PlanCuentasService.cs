using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

public class PlanCuentasService
{
    private readonly TytedContext _context;

    public PlanCuentasService(TytedContext context)
    {
        _context = context;
    }

    public async Task<List<CuentaContable>> GetCuentasAsync(int? empresaId)
        {
            var query = _context.CuentasContables.AsQueryable();

            if (empresaId.HasValue)
            {
                query = query.Where(c => c.EmpresaId == empresaId.Value);
            }

            return await query.OrderBy(c => c.CodigoCuenta).ToListAsync();
        }

    /// <summary>
    /// Formato único de la naturaleza en la base de datos: "D" (deudora) o "C"
    /// (acreedora). El formulario histórico enviaba "Deudora"/"Acreedora" y el
    /// plan sembrado usa "D"/"C"; los reportes comparaban sólo uno de los dos
    /// formatos y mostraban saldos con el signo invertido. Se aceptan los
    /// alias habituales y se rechaza cualquier otro valor.
    /// </summary>
    public static string NormalizarNaturaleza(string naturaleza)
    {
        var valor = (naturaleza ?? string.Empty).Trim();
        if (valor.Length == 0)
            throw new InvalidOperationException("La naturaleza de la cuenta es obligatoria (Deudora o Acreedora).");

        return char.ToUpperInvariant(valor[0]) switch
        {
            'D' => "D",
            'A' or 'C' or 'H' => "C",
            _ => throw new InvalidOperationException(
                $"Naturaleza «{valor}» no válida: use Deudora (D) o Acreedora (C).")
        };
    }

    public async Task<CuentaContable> CrearCuentaAsync(CuentaContable cuenta)
    {
        if (string.IsNullOrWhiteSpace(cuenta.CodigoCuenta))
            throw new InvalidOperationException("El código de la cuenta es obligatorio.");

        if (string.IsNullOrWhiteSpace(cuenta.NombreCuenta))
            throw new InvalidOperationException("El nombre de la cuenta es obligatorio.");

        cuenta.Naturaleza = NormalizarNaturaleza(cuenta.Naturaleza);

        if (cuenta.PadreCuentaId.HasValue)
        {
            var padreExiste = await _context.CuentasContables.AnyAsync(c => c.Id == cuenta.PadreCuentaId.Value);
            if (!padreExiste)
                throw new InvalidOperationException("La cuenta padre indicada no existe.");
        }

        _context.CuentasContables.Add(cuenta);
        await _context.SaveChangesAsync();
        return cuenta;
    }

    public async Task<CuentaContable> ActualizarCuentaAsync(int id, CuentaContable datos)
    {
        if (datos == null)
            throw new InvalidOperationException("Los datos de la cuenta son obligatorios.");

        if (string.IsNullOrWhiteSpace(datos.CodigoCuenta))
            throw new InvalidOperationException("El código de la cuenta es obligatorio.");

        if (string.IsNullOrWhiteSpace(datos.NombreCuenta))
            throw new InvalidOperationException("El nombre de la cuenta es obligatorio.");

        // Se carga la entidad rastreada por su Id (columna de identidad). Si no
        // existe se indica con KeyNotFoundException para que el controller
        // responda 404 y no intente INSERTAR una cuenta nueva con ese Id.
        var existente = await _context.CuentasContables.FindAsync(id);
        if (existente == null)
            throw new KeyNotFoundException($"La cuenta con identificador {id} no existe.");

        // El índice único (EmpresaId, CodigoCuenta) rechazaría la escritura con
        // un error crudo de SQL Server: se valida antes para devolver un
        // mensaje claro.
        var codigoDuplicado = await _context.CuentasContables.AnyAsync(c =>
            c.EmpresaId == datos.EmpresaId &&
            c.CodigoCuenta == datos.CodigoCuenta &&
            c.Id != id);
        if (codigoDuplicado)
            throw new InvalidOperationException($"Ya existe una cuenta con el código {datos.CodigoCuenta} en esta empresa.");

        if (datos.PadreCuentaId.HasValue)
        {
            if (datos.PadreCuentaId.Value == id)
                throw new InvalidOperationException("La cuenta no puede referenciarse a sí misma como cuenta padre.");

            var padreExiste = await _context.CuentasContables.AnyAsync(c => c.Id == datos.PadreCuentaId.Value);
            if (!padreExiste)
                throw new InvalidOperationException("La cuenta padre indicada no existe.");
        }

        // IMPORTANTE: nunca se asigna existente.Id. Sobre la entidad rastreada
        // sólo se actualizan campos, de modo que EF Core genera un UPDATE (un
        // INSERT con Id explícito provocaría el error 544 de SQL Server:
        // "Cannot insert explicit value for identity column").
        existente.EmpresaId = datos.EmpresaId;
        existente.CodigoCuenta = datos.CodigoCuenta.Trim();
        existente.NombreCuenta = datos.NombreCuenta.Trim();
        existente.TipoCuenta = string.IsNullOrWhiteSpace(datos.TipoCuenta) ? existente.TipoCuenta : datos.TipoCuenta.Trim();
        // Sin naturaleza en el payload se conserva la actual (normalizada, por
        // si la cuenta aún guarda el formato histórico "Deudora"/"Acreedora").
        existente.Naturaleza = NormalizarNaturaleza(
            string.IsNullOrWhiteSpace(datos.Naturaleza) ? existente.Naturaleza : datos.Naturaleza);
        existente.EsMovimiento = datos.EsMovimiento;
        existente.Nivel = datos.Nivel;
        existente.PadreCuentaId = datos.PadreCuentaId;
        existente.AceptaTerceros = datos.AceptaTerceros;
        existente.AceptaCentroCosto = datos.AceptaCentroCosto;
        existente.Activa = datos.Activa;

        await _context.SaveChangesAsync();
        return existente;
    }
}
