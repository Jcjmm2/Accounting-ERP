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
            if (id != producto.CodigoProd) return BadRequest();

            // 1. Limpiamos navegaciones para evitar Error 500
            producto.Categoria = null;
            producto.TasaIVA = null;
            producto.Proveedor = null;

            // 2. IMPORTANTE: Ignoramos la colección de UnidadesDeVenta aquí
            // para que este método solo actualice StockMinimo, IVA y Descripción.
            // Los precios los maneja el otro método.
            producto.UnidadesDeVenta = null; 

            _context.Entry(producto).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
                return Ok(new { message = "Datos maestros actualizados" });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ProductoExists(id)) return NotFound();
                else throw;
            }
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
        public async Task<IActionResult> ActualizarPreciosMasivo([FromBody] List<ActualizarPrecioDTO> preciosDto)
        {
            // 1. Validación de entrada
            if (preciosDto == null || !preciosDto.Any())
            {
                return BadRequest(new { message = "El servidor recibió una lista vacía o nula." });
            }

            // 2. Obtener tasa para sincronizar Bolívares (VES)
            var tasaObj = await _context.TasaDeCambio
                .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            decimal valorTasa = tasaObj?.Tasa ?? 1.0m;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var item in preciosDto)
                {
                    var unidad = await _context.ProductosUnidad.FindAsync(item.IdProductoUnidad);

                    if (unidad != null)
                    {
                        // A. Actualización de Precios en Dólares (Moneda Base)
                        // Quitamos la validación de "item.Precio1 == 0" para permitir el primer llenado desde la web
                        unidad.PrecioMonedaBase = item.Precio1;
                        unidad.Precio2MonedaBase = item.Precio2;
                        unidad.Precio3MonedaBase = item.Precio3;

                        // B. Sincronización con Bolívares (Moneda Extranjera @ 2 decimales)
                        unidad.PrecioMonedaExt = Math.Round(item.Precio1 * valorTasa, 2);
                        unidad.Precio2MonedaExt = Math.Round(item.Precio2 * valorTasa, 2);
                        unidad.Precio3MonedaExt = Math.Round(item.Precio3 * valorTasa, 2);

                        // C. Sincronizar con el Costo del Producto Maestro (Importante para reportes de utilidad)
                        var maestro = await _context.Productos.FindAsync(unidad.CodigoProd);
                        if (maestro != null)
                        {
                            unidad.CostoUnitarioMonedaBase = maestro.CostoUnitarioBase;
                            unidad.CostoUnitarioMonedaExt = Math.Round(maestro.CostoUnitarioBase * valorTasa, 4);
                        }

                        // Notificar a Entity Framework el cambio
                        _context.Entry(unidad).State = EntityState.Modified;
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = $"Se actualizaron {preciosDto.Count} presentaciones exitosamente." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                // Mantenemos el detalle del error por si falla algo en la base de datos (como un Trigger o un Constraint)
                string detalleError = ex.Message + (ex.InnerException != null ? " -> " + ex.InnerException.Message : "");
                return StatusCode(500, new { message = "Error al guardar precios", detail = detalleError });
            }
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
        [HttpGet("TasasIVA")] // La URL será /api/Productos/TasasIVA
        public async Task<ActionResult> GetTasasIVA()
        {
            var tasas = await _context.TasasIVA.ToListAsync();
            return Ok(tasas);
        }
        
        [HttpGet("buscar")]
        public async Task<IActionResult> Buscar([FromQuery] string termino, [FromQuery] decimal tasaDelDia)
        {
            if (string.IsNullOrWhiteSpace(termino)) return BadRequest("El término de búsqueda está vacío.");

            try
            {
                // Unificamos la lógica: traemos la unidad, el producto maestro y la tasa de IVA
                var resultados = await _context.ProductosUnidad
                    .Include(u => u.Producto)
                        .ThenInclude(p => p.TasaIVA)
                    .Where(u => u.Producto.Descripcion.Contains(termino) || 
                                u.NombreUnidad.Contains(termino) || 
                                u.CodigoBarras == termino ||
                                u.CodigoProd.Contains(termino))
                    .Take(20)
                    .ToListAsync();

                if (!resultados.Any())
                    return NotFound(new { message = "No se encontraron productos." });

                var respuesta = resultados.Select(u => new
                {
                    idProductoUnidad = u.IdProductoUnidad,
                    codigoProd = u.CodigoProd,
                    // Descripción amigable: "Arroz 1kg (Bulto)"
                    descripcion = $"{u.Producto.Descripcion} ({u.NombreUnidad})",
                    unidad = u.NombreUnidad,
                    precioMonedaBase = u.PrecioMonedaBase ?? 0m,
                    // Calculamos precio en Bolívares al vuelo usando la tasa enviada desde el frontend
                    precioVES = Math.Round((u.PrecioMonedaBase ?? 0m) * tasaDelDia, 2),
                    stockActual = u.Producto.StockActual,
                    // Datos de IVA cruciales para el carrito
                    porcentajeIva = u.Producto.TasaIVA != null ? u.Producto.TasaIVA.Porcentaje : 0,
                    esExento = u.Producto.TasaIVA != null && u.Producto.TasaIVA.Porcentaje == 0,
                    codigoBarras = u.CodigoBarras ?? "S/C",
                    // Identificamos si es un producto pesado (Kilos=3, Gramos=4 según lógica previa)
                    esPeso = u.IdUnidad == 3 || u.IdUnidad == 4 
                });

                return Ok(respuesta);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error en la búsqueda", detail = ex.Message });
            }
        }

        [HttpPut("ActualizarProductoCompleto")]
        public async Task<IActionResult> ActualizarProductoCompleto([FromBody] ActualizarProductoCompletoDto dto)
        {
            try
            {
                // 1. Buscar el producto base
                var producto = await _context.Productos
                    .Include(p => p.UnidadesDeVenta)
                    .FirstOrDefaultAsync(p => p.CodigoProd == dto.CodigoProd);

                if (producto == null) return NotFound("Producto no encontrado");

                // 2. Actualizar datos generales
                producto.TipoArt = dto.TipoArt;
                producto.IdTasaIVA = dto.IdTasaIVA;
                producto.StockMinimo = dto.StockMinimo;

                // 3. Obtener la tasa actual para recalcular precios en Bolívares (VES)
                var tasaActual = await _context.TasaDeCambio
                    .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                    .OrderByDescending(t => t.FechaVigencia)
                    .Select(t => t.Tasa)
                    .FirstOrDefaultAsync();

                // 4. Actualizar cada unidad de venta
                foreach (var uDto in dto.Unidades)
                {
                    var unidad = producto.UnidadesDeVenta
                        .FirstOrDefault(u => u.IdProductoUnidad == uDto.IdProductoUnidad);

                    if (unidad != null)
                    {
                        // Actualizar Precios en Dólares (Moneda Base)
                        unidad.PrecioMonedaBase = uDto.Precio1;
                        unidad.Precio2MonedaBase = uDto.Precio2;
                        unidad.Precio3MonedaBase = uDto.Precio3;

                        // Recalcular Precios en Bolívares (Moneda Extranjera)
                        if (tasaActual > 0)
                        {
                            unidad.PrecioMonedaExt = uDto.Precio1 * tasaActual;
                            unidad.Precio2MonedaExt = uDto.Precio2 * tasaActual;
                            unidad.Precio3MonedaExt = uDto.Precio3 * tasaActual;
                        }
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = "Producto actualizado íntegramente." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }        

        // DTO necesario para recibir los datos
        public class ActualizarProductoCompletoDto
        {
            public string CodigoProd { get; set; }
            public string TipoArt { get; set; }
            public int IdTasaIVA { get; set; }
            public decimal StockMinimo { get; set; }
            public List<UnidadPrecioDto> Unidades { get; set; }
        }

        public class UnidadPrecioDto
        {
            public int IdProductoUnidad { get; set; }
            public decimal Precio1 { get; set; }
            public decimal Precio2 { get; set; }
            public decimal Precio3 { get; set; }
        }
        
        
    }
    public class ActualizarPrecioDTO
    {
        public int IdProductoUnidad { get; set; } // DEBE ser int
        public decimal Precio1 { get; set; }      // DEBE ser decimal
        public decimal Precio2 { get; set; }      // DEBE ser decimal
        public decimal Precio3 { get; set; }      // DEBE ser decimal
    }
}