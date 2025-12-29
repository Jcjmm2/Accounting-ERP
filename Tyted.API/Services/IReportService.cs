using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;

namespace Tyted.API.Services
{
    public interface IReportService
    {
        Task<byte[]> GenerarExcelMargenesAsync();
        Task<byte[]> GenerarPdfCierreCajaAsync(DateTime fecha);
        Task<byte[]> GenerarExcelInventarioValoradoAsync();
    }
}