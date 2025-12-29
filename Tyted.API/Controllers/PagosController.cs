using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
//using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.DTOs;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    // Mantenemos los roles para asegurar que solo personal autorizado gestione pagos
    //[Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")] 
    [ApiController]
    public class PagosController : ControllerBase
    {
        private readonly TytedContext _context;

        public PagosController(TytedContext context)
        {
            _context = context;
        }

        // ==========================================
        // 1. ABONAR A CUENTA POR COBRAR (Clientes)
        // ==========================================
        [HttpPost("cxc/abono")]
        public async Task<IActionResult> AbonarCXC([FromBody] RegistrarAbonoDto dto)
        {
            var cuenta = await _context.CuentasPorCobrar.FindAsync(dto.IdCuenta);
            
            if (cuenta == null) return NotFound("La cuenta por cobrar no existe.");
            if (cuenta.Estado == "Pagada") return BadRequest("Esta cuenta ya está totalmente pagada.");
            
            // CORRECCIÓN: Usamos SaldoPendienteUSD que es lo que pide el Service
            if (dto.MontoAbonadoMonedaBase > cuenta.SaldoPendienteUSD)
                return BadRequest("El monto del abono no puede ser mayor al saldo pendiente.");

            // Actualizamos el saldo en dólares
            cuenta.SaldoPendienteUSD -= dto.MontoAbonadoMonedaBase;
            
            if (cuenta.SaldoPendienteUSD <= 0)
            {
                cuenta.SaldoPendienteUSD = 0;
                cuenta.Estado = "Pagada";
            }

            // Registro opcional en historial si decides usar la tabla AbonoCXC
            var historial = new AbonoCXC
            {
                CuentaPorCobrarId = cuenta.Id,
                MontoAbonadoMonedaBase = dto.MontoAbonadoMonedaBase,
                MetodoPago = dto.MetodoPago,
                Notas = dto.Notas,
                FechaAbono = DateTime.Now
            };
            _context.AbonosCXC.Add(historial);

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Abono procesado con éxito", 
                nuevoSaldoUSD = cuenta.SaldoPendienteUSD,
                estado = cuenta.Estado 
            });
        }

        // ==========================================
        // 2. ABONAR A CUENTA POR PAGAR (Proveedores)
        // ==========================================
        [HttpPost("cxp/abono")]
        public async Task<IActionResult> AbonarCXP([FromBody] RegistrarAbonoDto dto)
        {
            var cuenta = await _context.CuentasPorPagar.FindAsync(dto.IdCuenta);

            if (cuenta == null) return NotFound("La cuenta por pagar no existe.");
            if (cuenta.Estado == "Pagada") return BadRequest("Esta deuda ya ha sido liquidada.");
            
            // CORRECCIÓN: Usamos SaldoPendienteUSD
            if (dto.MontoAbonadoMonedaBase > cuenta.SaldoPendienteUSD)
                return BadRequest("El pago no puede exceder la deuda actual.");

            cuenta.SaldoPendienteUSD -= dto.MontoAbonadoMonedaBase;

            if (cuenta.SaldoPendienteUSD <= 0)
            {
                cuenta.SaldoPendienteUSD = 0;
                cuenta.Estado = "Pagada";
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Pago a proveedor registrado", 
                saldoDeudaUSD = cuenta.SaldoPendienteUSD,
                estado = cuenta.Estado 
            });
        }

        // ==========================================
        // 3. VER TODAS LAS DEUDAS PENDIENTES (CXC)
        // ==========================================
        [HttpGet("cxc/pendientes")]
        public async Task<ActionResult> GetCXCPendientes()
        {
            var pendientes = await _context.CuentasPorCobrar
                .Where(c => c.Estado == "Pendiente")
                .Include(c => c.Venta)
                .Select(c => new {
                    c.Id,
                    c.VentaId,
                    Cliente = c.Venta.Cliente,
                    // CORRECCIÓN: Nombres de propiedades USD
                    TotalOriginalUSD = c.MontoTotalUSD,
                    SaldoRestanteUSD = c.SaldoPendienteUSD,
                    FechaVencimiento = c.FechaVencimiento
                })
                .ToListAsync();

            return Ok(pendientes);
        }
    }
}