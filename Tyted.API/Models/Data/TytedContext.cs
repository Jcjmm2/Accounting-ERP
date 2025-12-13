using Microsoft.EntityFrameworkCore;
using Tyted.API.Models;

namespace Tyted.API.Data
{
    public class TytedContext : DbContext
    {
        public TytedContext(DbContextOptions<TytedContext> options) : base(options)
        {
        }

        public DbSet<Proveedor> Proveedores { get; set; } = default!;
        public DbSet<Producto> Productos { get; set; } = default!;
        public DbSet<UnidadMedida> UnidadesMedida { get; set; } = default!;
        public DbSet<ProductosUnidad> ProductosUnidad { get; set; } = default!;
        public DbSet<TasaDeCambio> TasasDeCambio { get; set; } = default!;
        public DbSet<Compra> Compras { get; set; } = null!;
        public DbSet<CompraDetalle> ComprasDetalle { get; set; } = null!;
        

        // ======================================
        // FUNCIÓN DE INICIALIZACIÓN DE DATOS (SEEDING)
        // ======================================
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Inyectar datos iniciales para el catálogo de Unidades de Medida
            modelBuilder.Entity<UnidadMedida>().HasData(
                new UnidadMedida { IdUnidad = 1, NombreUnidad = "Unidad" },
                new UnidadMedida { IdUnidad = 2, NombreUnidad = "Caja" },
                new UnidadMedida { IdUnidad = 3, NombreUnidad = "Paquete" },
                new UnidadMedida { IdUnidad = 4, NombreUnidad = "Kilogramo" },
                new UnidadMedida { IdUnidad = 5, NombreUnidad = "Litro" }
            );
        }
    }
}