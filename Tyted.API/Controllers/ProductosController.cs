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
    public class ProductosController : ControllerBase
    {
        private readonly TytedContext _context;

        public ProductosController(TytedContext context)
        {
            _context = context;
        }

        // GET: api/Productos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Producto>>> GetProductos()
        {
            return await _context.Productos
                .Include(p => p.Categoria)
                .Include(p => p.TasaIVA)
                .Include(p => p.UnidadesDeVenta) // Trae las unidades (Bulto, Detalle, etc.)
                .ToListAsync();
        }

        // GET: api/Productos/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Producto>> GetProducto(string id)
        {
            var producto = await _context.Productos
                .Include(p => p.UnidadesDeVenta)
                .Include(p => p.Categoria)
                .FirstOrDefaultAsync(p => p.CodigoProd == id);

            if (producto == null) return NotFound();

            return producto;
        }

        // POST: api/Productos
        [HttpPost]
        public async Task<ActionResult<Producto>> PostProducto(Producto producto)
        {
            // SEGURIDAD: Si el JSON no coincide con el Modelo, producto será null
            if (producto == null)
            {
                return BadRequest("El formato del producto no es válido o faltan campos obligatorios.");
            }

            // Si tu línea 51 era algo como _context.Productos.Add(producto), 
            // ahora no fallará porque verificamos el nulo antes.
            _context.Productos.Add(producto);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetProducto", new { id = producto.CodigoProd }, producto);
        }

        // PUT: api/Productos/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutProducto(string id, Producto producto)
        {
            if ( id != producto.CodigoProd) return BadRequest();

            _context.Entry(producto).State = EntityState.Modified;

            // También debemos manejar la actualización de las unidades de venta si vienen en el objeto
            if (producto.UnidadesDeVenta != null)
            {
                foreach (var unidad in producto.UnidadesDeVenta)
                {
                    _context.Entry(unidad).State = unidad.IdProductoUnidad == 0 
                        ? EntityState.Added 
                        : EntityState.Modified;
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ProductoExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        private bool ProductoExists(string id)
        {
            return _context.Productos.Any(e => e.CodigoProd == id);
        }

        [HttpGet("buscar-pos/{codigoBarras}")]
        public async Task<IActionResult> BuscarProductoPOS(string codigoBarras, [FromQuery] decimal tasaDelDia)
        {
            // 1. Buscamos la unidad que coincida con el código de barras
            // Incluimos el Producto maestro para tener la descripción y el StockActual
            var unidad = await _context.ProductosUnidad
                .Include(u => u.Producto)
                .FirstOrDefaultAsync(u => u.CodigoBarras == codigoBarras);

            if (unidad == null)
                return NotFound(new { message = "Producto no encontrado con ese código de barras." });

            var producto = unidad.Producto;

            // 2. Buscamos TODAS las presentaciones de ese mismo producto 
            // Para que el cajero pueda elegir (Caja, Detal, etc.)
            var todasLasUnidades = await _context.ProductosUnidad
                .Where(u => u.CodigoProd == producto.CodigoProd)
                .ToListAsync();

            // 3. Construimos la respuesta con los precios calculados en VES
            var respuesta = new
            {
                CodigoProd = producto.CodigoProd,
                Descripcion = producto.Descripcion,
                StockActual = producto.StockActual,
                TasaIVA = producto.IdTasaIVA == 2 ? 16.0m : 0m, // Ajustar según tu lógica de IVA
                PresentacionSugeridaId = unidad.IdProductoUnidad, // La que escaneó
                OpcionesUnidad = todasLasUnidades.Select(u => new
                {
                    u.IdProductoUnidad,
                    u.NombreUnidad,
                    u.CantidadEquivalente,
                    PrecioUSD = u.PrecioMonedaBase ?? 0m,
PrecioVES = Math.Round((u.PrecioMonedaBase ?? 0m) * tasaDelDia, 2)
                })
            };

            return Ok(respuesta);
        }
        [HttpPut("ActualizarPreciosMasivo")]
        public async Task<IActionResult> ActualizarPreciosMasivo([FromBody] List<ActualizarPrecioDTO> listaPrecios)
        {
            if (listaPrecios == null || !listaPrecios.Any())
                return BadRequest("No se enviaron datos.");

            // 1. Obtenemos la tasa de cambio actual para actualizar también los precios en VES
            var tasaObj = await _context.TasaDeCambio
                .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            decimal valorTasa = tasaObj?.Tasa ?? 1.0m;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var item in listaPrecios)
                {
                    int idBuscado = Convert.ToInt32(item.IdProductoUnidad);

                    var unidad = await _context.ProductosUnidad
                        .FirstOrDefaultAsync(u => u.IdProductoUnidad == idBuscado);

                    if (unidad != null)
                    {
                        // Actualización de Precios en Dólares (Moneda Base)
                        unidad.PrecioMonedaBase = item.Precio1;
                        unidad.Precio2MonedaBase = item.Precio2;
                        unidad.Precio3MonedaBase = item.Precio3;

                        // Sincronización automática con Bolívares (Moneda Extranjera)
                        unidad.PrecioMonedaExt = Math.Round(item.Precio1 * valorTasa, 2);
                        unidad.Precio2MonedaExt = Math.Round(item.Precio2 * valorTasa, 2);
                        unidad.Precio3MonedaExt = Math.Round(item.Precio3 * valorTasa, 2);

                        // Actualizar Costos si el producto maestro cambió
                        var maestro = await _context.Productos.FindAsync(unidad.CodigoProd);
                        if (maestro != null)
                        {
                            unidad.CostoUnitarioMonedaBase = maestro.CostoUnitarioBase;
                            unidad.CostoUnitarioMonedaExt = Math.Round(maestro.CostoUnitarioBase * valorTasa, 4);
                        }

                        _context.Entry(unidad).State = EntityState.Modified;
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = $"Se actualizaron {listaPrecios.Count} presentaciones exitosamente." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }
        public class ActualizarPrecioDTO
    {
        public string IdProductoUnidad { get; set; }
        public decimal Precio1 { get; set; } // NuevoPrecioUSD (Precio Principal)
        public decimal Precio2 { get; set; } // Precio Mayor / Especial
        public decimal Precio3 { get; set; } // Precio Distribuidor / Otro
    }
        // GET: api/Productos/stock-critico
        [HttpGet("stock-critico")]
        public async Task<ActionResult> GetStockCritico()
        {
            // Buscamos productos donde el stock actual sea igual o menor al mínimo
            // Excluimos servicios si tienes (ej. productos que no manejan stock)
            var productosCriticos = await _context.Productos
                .Where(p => p.StockActual <= p.StockMinimo)
                .Select(p => new {
                    p.CodigoProd,
                    p.Descripcion,
                    p.StockActual,
                    p.StockMinimo,
                    Estado = p.StockActual <= 0 ? "Agotado" : "Bajo Stock",
                    Faltante = p.StockMinimo - p.StockActual
                })
                .OrderBy(p => p.StockActual)
                .ToListAsync();

            return Ok(productosCriticos);
        }
        [HttpGet("buscar")]
        public async Task<IActionResult> Buscar([FromQuery] string termino, [FromQuery] decimal tasaDelDia)
        {
            if (string.IsNullOrWhiteSpace(termino)) return BadRequest("Termo de busca vazio.");

            // Buscamos em ProductosUnidad incluindo a tabela maestra Productos
            // para filtrar tanto pelo nome do produto como pelo nome da unidade ou código
            var resultados = await _context.ProductosUnidad
                .Include(u => u.Producto)
                .Where(u => u.Producto.Descripcion.Contains(termino) || 
                            u.NombreUnidad.Contains(termino) || 
                            u.CodigoBarras == termino ||
                            u.CodigoProd.Contains(termino))
                .Take(15)
                .ToListAsync();

            if (!resultados.Any())
                return NotFound(new { message = "Nenhum produto encontrado." });

            var respuesta = resultados.Select(u => new
            {
                IdProductoUnidad = u.IdProductoUnidad,
                CodigoProd = u.CodigoProd,
                // Exemplo: "HARINA PAN BLANCA 1KG (Bulto 20 unidades)"
                Descripcion = $"{u.Producto.Descripcion} ({u.NombreUnidad})",
                Unidad = u.NombreUnidad,
                PrecioUSD = u.PrecioMonedaBase ?? 0m,
                // Calculamos o preço em BS com base na taxa enviada pelo frontend
                PrecioVES = Math.Round((u.PrecioMonedaBase ?? 0m) * tasaDelDia, 2),
                StockActual = u.Producto.StockActual,
                CodigoBarras = u.CodigoBarras ?? "S/C",
                EsPeso = u.IdUnidad == 3 || u.IdUnidad == 4 // Kilo ou Gramo (Baseado nos seus IDs 3 e 4)
            });

            return Ok(respuesta);
        }
        
    }
    public class ActualizarPrecioDTO
    {
    public string IdProductoUnidad { get; set; } // El ID específico de la presentación (Caja, Detal, etc.)
    public decimal NuevoPrecioUSD { get; set; } // El nuevo precio 1 que aceptó el usuario
    }
}