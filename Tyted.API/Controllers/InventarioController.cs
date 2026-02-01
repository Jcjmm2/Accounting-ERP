using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InventarioController : ControllerBase
    {
        private readonly TytedContext _context;

        public InventarioController(TytedContext context)
        {
            _context = context;
        }

        [HttpGet("movimientos/{codigoProd}")]
        public async Task<IActionResult> GetMovimientos(string codigoProd)
        {
            var movimientos = await _context.InventarioMovimientos
                .Where(m => m.CodigoProd == codigoProd)
                .OrderByDescending(m => m.Fecha)
                .ToListAsync();

            return Ok(movimientos);
        }

        // 1. AJUSTE INDIVIDUAL (Refactorizado para usar la lógica compartida)
        [HttpPost("ajuste")]
        public async Task<IActionResult> RegistrarAjuste([FromBody] AjusteInventarioDto ajuste)
        {
            using var transaction = _context.Database.BeginTransaction();
            try
            {
                // Llamamos a la lógica interna
                var resultado = await ProcesarAjusteInterno(ajuste);
                
                // Guardamos cambios y confirmamos transacción
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { mensaje = "Ajuste realizado con éxito", nuevoStock = resultado });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Error: " + ex.Message);
            }
        }

        // 2. AJUSTE MASIVO (Nuevo Método)
        [HttpPost("ajuste-masivo")]
        public async Task<IActionResult> AjusteMasivo([FromBody] List<AjusteInventarioDto> listaAjustes)
        {
            // Usamos una sola transacción para TODO el lote. 
            // Si falla un producto, se cancela todo para evitar descuadres.
            using var transaction = _context.Database.BeginTransaction();
            try
            {
                int procesados = 0;

                foreach (var ajuste in listaAjustes)
                {
                    // Solo procesamos si la cantidad es diferente de 0
                    if (ajuste.Cantidad != 0)
                    {
                        await ProcesarAjusteInterno(ajuste);
                        procesados++;
                    }
                }

                // Guardamos todo de golpe al final
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { mensaje = $"Se procesaron {procesados} ajustes correctamente." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "Error en carga masiva: " + ex.Message);
            }
        }

        // --- MÉTODO PRIVADO (La lógica compartida) ---
        // Este método NO guarda cambios (SaveChangesAsync), solo prepara los datos.
        // Quien lo llame es responsable de guardar y manejar la transacción.
        private async Task<decimal> ProcesarAjusteInterno(AjusteInventarioDto ajuste)
        {
            // A. Buscar Producto
            var producto = await _context.Productos
                .FirstOrDefaultAsync(p => p.CodigoProd == ajuste.CodigoProd);

            if (producto == null) throw new Exception($"Producto {ajuste.CodigoProd} no encontrado");

            // B. Buscar Unidad
            var unidadInfo = await _context.ProductosUnidad
                .FirstOrDefaultAsync(u => u.IdProductoUnidad == ajuste.IdUnidadMedida);

            if (unidadInfo == null) throw new Exception($"Unidad ID {ajuste.IdUnidadMedida} no válida para {ajuste.CodigoProd}");

            // C. Calcular Equivalencia
            decimal cantidadBase = ajuste.Cantidad * unidadInfo.CantidadEquivalente;

            // D. Actualizar Stock en Memoria
            if (ajuste.TipoMovimiento == "Entrada")
            {
                producto.StockActual += cantidadBase;
            }
            else
            {
                producto.StockActual -= cantidadBase;
            }

            // E. Crear el Movimiento (Kardex)
            var movimiento = new InventarioMovimiento
            {
                CodigoProd = ajuste.CodigoProd,
                Fecha = DateTime.Now,
                Tipo = ajuste.TipoMovimiento,
                Cantidad = ajuste.Cantidad,     // Cantidad visual (ej: 5 Cajas)
                // Asegúrate que tu modelo InventarioMovimiento tenga el campo Unidad si lo deseas guardar
                // Unidad = unidadInfo.NombreUnidad, 
                Concepto = ajuste.Concepto,
                CostoUnitarioUSD = producto.CostoUnitarioBase
            };

            // Agregamos a la cola de cambios del contexto
            _context.InventarioMovimientos.Add(movimiento);

            return producto.StockActual;
        }

    } // Fin Clase
}