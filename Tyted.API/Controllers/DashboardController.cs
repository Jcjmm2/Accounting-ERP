using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly EstadisticasService _estadisticasService;
        public DashboardController(EstadisticasService estadisticasService)
          {
            _estadisticasService = estadisticasService;
          }

        [HttpGet("resumen-gerencial")]
        public async Task<IActionResult> GetResumen()
        {
        var data = await _estadisticasService.GetDashboardAsync();
        return Ok(data);
        }
    }
}