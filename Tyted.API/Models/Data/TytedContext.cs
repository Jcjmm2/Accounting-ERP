using Microsoft.EntityFrameworkCore;
using Tyted.API.Models;

namespace Tyted.API.Data
{
    public class TytedContext : DbContext
    {
        public TytedContext(DbContextOptions<TytedContext> options) : base(options) { }

        // --- ENTIDADES ---
        public DbSet<Proveedor> Proveedores { get; set; } = default!;
        public DbSet<Producto> Productos { get; set; } = default!;
        public DbSet<UnidadMedida> UnidadesMedida { get; set; } = default!;
        public DbSet<ProductosUnidad> ProductosUnidad { get; set; } = default!;
        public DbSet<TasaDeCambio> TasaDeCambio { get; set; } = default!; // IMPORTANTE
        public DbSet<Compra> Compras { get; set; } = null!;
        public DbSet<CompraDetalle> ComprasDetalle { get; set; } = null!;
        public DbSet<Categoria> Categorias { get; set; } = default!;
        public DbSet<TasaIVA> TasasIVA { get; set; } = default!;
        public DbSet<Moneda> Monedas { get; set; } = default!;
        public DbSet<Venta> Ventas { get; set; } = default!;
        public DbSet<VentaDetalle> VentasDetalle { get; set; } = default!;
        public DbSet<InventarioMovimiento> InventarioMovimientos { get; set; } = default!;
        public DbSet<EmpresaConfig> EmpresaConfigs { get; set; } = default!;
        public DbSet<Empresa> Empresa { get; set; } = default!;
        public DbSet<Usuario> Usuarios { get; set; } = default!;
        public DbSet<Cliente> Clientes { get; set; } = default!;
        public DbSet<CajaSesion> CajaSesiones { get; set; }
        public DbSet<VentaPago> VentasPagos { get; set; }
        
        // --- CRÉDITOS ---
        public DbSet<CuentaPorCobrar> CuentasPorCobrar { get; set; } = default!;
        public DbSet<AbonoCXC> AbonosCXC { get; set; } = default!;
        public DbSet<CuentaPorPagar> CuentasPorPagar { get; set; } = default!;

        // --- VENTAS: PEDIDOS ---
        public DbSet<Pedido> Pedidos { get; set; } = default!;
        public DbSet<PedidoDetalle> PedidosDetalle { get; set; } = default!;

        // --- COMPRAS: NOTAS DE ENTREGA ---    
        public DbSet<NotaEntregaCompra> NotasEntregaCompra { get; set; } = default!;
        public DbSet<NotaEntregaCompraDetalle> NotasEntregaCompraDetalle { get; set; } = default!;

        // --- FISCAL (IVA SENIAT) ---
        public DbSet<RetencionIvaEmitida> RetencionesIvaEmitidas { get; set; } = default!;
        public DbSet<Gasto> Gastos { get; set; } = default!;

        // --- CONTABILIDAD ---
        public DbSet<CuentaContable> CuentasContables { get; set; } = default!;
        public DbSet<PeriodoContable> PeriodosContables { get; set; } = default!;
        public DbSet<AsientoContable> AsientosContables { get; set; } = default!;
        public DbSet<AsientoDetalle> AsientosDetalles { get; set; } = default!;
        public DbSet<AuditoriaContable> AuditoriasContables { get; set; } = default!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. CONFIGURACIÓN GLOBAL DE DECIMALES (18, 4)
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var properties = entityType.GetProperties()
                    .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?));

                foreach (var property in properties)
                {
                    property.SetColumnType("decimal(18, 4)");
                }
            }

            // 2. EXCEPCIONES DE PRECISIÓN (Tasa de cambio requiere 6 decimales)
            modelBuilder.Entity<TasaDeCambio>(entity => {
                entity.Property(e => e.Tasa).HasColumnType("decimal(18, 6)");
                entity.Property(e => e.FactorSugerido).HasColumnType("decimal(18, 6)");
            });

            modelBuilder.Entity<Categoria>()
                .Property(e => e.PorcentajeMargen).HasColumnType("decimal(5, 2)");

            modelBuilder.Entity<TasaIVA>()
                .Property(e => e.Porcentaje).HasColumnType("decimal(5, 2)");

            modelBuilder.Entity<ProductosUnidad>(entity =>
            {
                entity.Property(e => e.Margen1).HasColumnType("decimal(5, 2)");
                entity.Property(e => e.Margen2).HasColumnType("decimal(5, 2)");
                entity.Property(e => e.Margen3).HasColumnType("decimal(5, 2)");

                entity.HasOne(u => u.Producto)
                      .WithMany(p => p.UnidadesDeVenta)
                      .HasForeignKey(u => u.CodigoProd)
                      .OnDelete(DeleteBehavior.Restrict); 
            });
            modelBuilder.Entity<Cliente>()
                .HasIndex(c => c.Rif)
                .IsUnique();

            modelBuilder.Entity<CuentaContable>()
                .HasIndex(c => new { c.EmpresaId, c.CodigoCuenta })
                .IsUnique();

            modelBuilder.Entity<CuentaContable>()
                .HasOne(c => c.Padre)
                .WithMany(c => c.Hijos)
                .HasForeignKey(c => c.PadreCuentaId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PeriodoContable>()
                .HasIndex(p => new { p.EmpresaId, p.Anio, p.Mes })
                .IsUnique();

            modelBuilder.Entity<AsientoDetalle>()
                .HasOne(d => d.CuentaContable)
                .WithMany()
                .HasForeignKey(d => d.CuentaContableId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AsientoDetalle>()
                .HasOne(d => d.AsientoContable)
                .WithMany(a => a.Detalles)
                .HasForeignKey(d => d.AsientoContableId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AsientoContable>()
                .HasOne(a => a.PeriodoContable)
                .WithMany(p => p.Asientos)
                .HasForeignKey(a => a.PeriodoContableId)
                .OnDelete(DeleteBehavior.Restrict);

            // 3. CONFIGURACIÓN DE RELACIONES Y SEEDING (Omitido para brevedad, mantener igual)
            // ... (Tus relaciones y DataSeed de Usuario, Empresa, etc.)
        }
    }
}