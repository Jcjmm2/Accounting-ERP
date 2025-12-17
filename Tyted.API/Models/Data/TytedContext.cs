using Microsoft.EntityFrameworkCore;
using Tyted.API.Models;
using System.Collections.Generic; // Asegúrese de que este using esté presente si no lo estaba

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
        public DbSet<TasaDeCambio> TasaDeCambio { get; set; } = default!;
        public DbSet<Compra> Compras { get; set; } = null!;
        public DbSet<CompraDetalle> ComprasDetalle { get; set; } = null!;
        
        // =========================================================
        // ✅ AGREGAR LOS NUEVOS DbSETS (Categoría y TasaIVA)
        // =========================================================
        public DbSet<Categoria> Categorias { get; set; } = default!;
        public DbSet<TasaIVA> TasasIVA { get; set; } = default!;

        // ======================================
        // FUNCIÓN DE INICIALIZACIÓN DE DATOS (SEEDING)
        // ======================================
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Inyectar datos iniciales para el catálogo de Unidades de Medida (EXISTENTE)
            modelBuilder.Entity<UnidadMedida>().HasData(
                new UnidadMedida { IdUnidad = 1, NombreUnidad = "Unidad" },
                new UnidadMedida { IdUnidad = 2, NombreUnidad = "Caja" },
                new UnidadMedida { IdUnidad = 3, NombreUnidad = "Paquete" },
                new UnidadMedida { IdUnidad = 4, NombreUnidad = "Kilogramo" },
                new UnidadMedida { IdUnidad = 5, NombreUnidad = "Litro" }
            );

            // =========================================================
            // ✅ AGREGAR DATOS INICIALES PARA EL CATÁLOGO DE TASAS DE IVA
            // =========================================================
            modelBuilder.Entity<TasaIVA>().HasData(
                // ⚠️ Importante: Los IDs aquí deben coincidir si se usan en la inicialización de Productos.
                new TasaIVA { IdTasaIVA = 1, Nombre = "Exento (0%)", Porcentaje = 0.00m },
                new TasaIVA { IdTasaIVA = 2, Nombre = "Tasa Reducida (8%)", Porcentaje = 8.00m },
                new TasaIVA { IdTasaIVA = 3, Nombre = "Tasa General (16%)", Porcentaje = 16.00m },
                new TasaIVA { IdTasaIVA = 4, Nombre = "Tasa Adicional (31%)", Porcentaje = 31.00m }
            );
            
            // Opcional: Inyectar categorías iniciales para que la base de datos no quede vacía.
            // (Es mejor agregarlas aquí para que el campo IdCategoria en Producto no falle).
            modelBuilder.Entity<Categoria>().HasData(
                 new Categoria { IdCategoria = 1, Nombre = "Víveres Básicos", PorcentajeMargen = 15.00m },
                 new Categoria { IdCategoria = 2, Nombre = "Artículos de Higiene", PorcentajeMargen = 30.00m },
                 new Categoria { IdCategoria = 3, Nombre = "Snacks y Golosinas", PorcentajeMargen = 35.00m }
            );


            // Configuración adicional para la relación Producto <-> ProductosUnidad (si es necesario)
            // Si la relación no está configurada, se recomienda añadir esto para evitar errores:
            modelBuilder.Entity<ProductosUnidad>()
                .HasOne(pu => pu.Producto)
                .WithMany(p => p.UnidadesDeVenta)
                .HasForeignKey("ProductoCodigoProd"); 

            // Si hay otras configuraciones de relaciones, deben ir aquí.
        }
    }
}