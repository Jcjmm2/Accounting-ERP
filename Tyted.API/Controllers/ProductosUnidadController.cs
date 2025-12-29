using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
//using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    //[Authorize(Roles = "AdministradorSistema,Administrador,Comprador")]
    [ApiController]
    public class ProductosUnidadController : ControllerBase
    {
        private readonly TytedContext _context;

        public ProductosUnidadController(TytedContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<ActionResult<ProductosUnidad>> PostProductosUnidad(ProductosUnidad unidad)
        {
            // 1. Buscamos de forma selectiva para evitar el error de Cast en CodigoProv
            // Traemos solo lo necesario para validar y calcular
            var infoProducto = await _context.Productos
                .Where(p => p.CodigoProd == unidad.CodigoProd)
                .Select(p => new { p.CodigoProd, p.PermiteDesglose }) 
                .FirstOrDefaultAsync();

            if (infoProducto == null)
            {
                return NotFound($"Error: El producto con código {unidad.CodigoProd} no existe.");
            }

            // 2. Lógica de Costo 0 y Desglose (usando infoProducto)
            if (unidad.CostoUnitarioMonedaBase == 0)
            {
                if (infoProducto.PermiteDesglose)
                {
                    // Buscamos el bulto (Cantidad > 1) para prorratear el costo
                    var bulto = await _context.ProductosUnidad
                        .AsNoTracking()
                        .Where(u => u.CodigoProd == unidad.CodigoProd && u.CantidadEquivalente > 1)
                        .OrderByDescending(u => u.CantidadEquivalente)
                        .FirstOrDefaultAsync();

                    if (bulto != null)
                    {
                        unidad.CostoUnitarioMonedaBase = bulto.CostoUnitarioMonedaBase / bulto.CantidadEquivalente;
                    }
                    else
                    {
                        return BadRequest("Este producto permite desglose, pero no se encontró un bulto registrado para calcular el costo.");
                    }
                }
                else
                {
                    return BadRequest("Este producto no permite desglose automático. Debe ingresar el costo manualmente.");
                }
            }

            // 3. Obtener Tasa de Cambio actual
            var tasaObj = await _context.TasaDeCambio
                .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            decimal valorTasa = tasaObj?.Tasa ?? 1.0m;

            // 4. Cálculos de Precios en Moneda Base (Dólares)
            unidad.PrecioMonedaBase = unidad.CostoUnitarioMonedaBase * (1 + (unidad.Margen1 ?? 0) / 100);
    
            if (unidad.Margen2.HasValue)
                unidad.Precio2MonedaBase = unidad.CostoUnitarioMonedaBase * (1 + (unidad.Margen2.Value / 100));

            if (unidad.Margen3.HasValue)
                unidad.Precio3MonedaBase = unidad.CostoUnitarioMonedaBase * (1 + (unidad.Margen3.Value / 100));

            // 5. Conversión a Moneda Extranjera (Bolívares)
            unidad.CostoUnitarioMonedaExt = unidad.CostoUnitarioMonedaBase * valorTasa;
            unidad.PrecioMonedaExt = unidad.PrecioMonedaBase * valorTasa;
            unidad.Precio2MonedaExt = (unidad.Precio2MonedaBase ?? 0) * valorTasa;
            unidad.Precio3MonedaExt = (unidad.Precio3MonedaBase ?? 0) * valorTasa;

            // 6. Limpieza de navegación para evitar errores de validación e inserción
            ModelState.Remove("Producto");
            ModelState.Remove("UnidadMedida");
            unidad.Producto = null; 
            unidad.UnidadMedida = null;

            // 7. Guardar en Base de Datos
            _context.ProductosUnidad.Add(unidad);
            await _context.SaveChangesAsync();

            return Ok(unidad);
        }

        [HttpGet("Producto/{codigoProd}")]
        public async Task<ActionResult<IEnumerable<ProductosUnidad>>> GetUnidadesPorProducto(String codigoProd)
        {
            return await _context.ProductosUnidad
                .Where(u => u.CodigoProd == codigoProd)
                .ToListAsync();
        }
        [HttpPost("RecalcularPreciosBolivares")]
        public async Task<IActionResult> RecalcularPrecios()
        {
            // 1. Obtener la tasa más reciente que acabas de crear (54.75)
            var tasaObj = await _context.TasaDeCambio
                .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            if (tasaObj == null) return BadRequest("No hay una tasa configurada.");

            decimal valorTasa = tasaObj.Tasa;

            // 2. Traer todas las unidades de productos
            var unidades = await _context.ProductosUnidad.ToListAsync();

            // 3. Actualizar los precios en moneda extranjera basándose en el precio en USD
            foreach (var u in unidades)
            {
                u.CostoUnitarioMonedaExt = u.CostoUnitarioMonedaBase * valorTasa;
                u.PrecioMonedaExt = u.PrecioMonedaBase * valorTasa;
                u.Precio2MonedaExt = (u.Precio2MonedaBase ?? 0) * valorTasa;
                u.Precio3MonedaExt = (u.Precio3MonedaBase ?? 0) * valorTasa;
            }

            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Precios actualizados", tasaAplicada = valorTasa, totalProductos = unidades.Count });
        }
    }
}