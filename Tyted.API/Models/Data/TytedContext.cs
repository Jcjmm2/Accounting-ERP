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
        /// <summary>Acceso Multi-Empresa: qué empresas puede ver cada usuario.</summary>
        public DbSet<UsuarioEmpresa> UsuariosEmpresas { get; set; } = default!;
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
        /// <summary>Retenciones de ISLR emitidas (valor legal en Bolívares, inmutables).</summary>
        public DbSet<RetencionIslrEmitida> RetencionesIslrEmitidas { get; set; } = default!;
        /// <summary>Resúmenes de la máquina fiscal (cierre Z) del Libro de Ventas SENIAT.</summary>
        public DbSet<ResumenVentaFiscal> ResumenesVentasFiscales { get; set; } = default!;
public DbSet<ResumenVentaFiscalDetalle> ResumenesVentasFiscalesDetalles { get; set; } = default!;
        /// <summary>Conceptos de operación (GASTO/VENTA/COMPRA) por empresa: puente al plan de cuentas.</summary>
        public DbSet<ConceptoOperacional> ConceptosOperacionales { get; set; } = default!;

        // --- CONTABILIDAD ---
        public DbSet<CuentaContable> CuentasContables { get; set; } = default!;
        public DbSet<PeriodoContable> PeriodosContables { get; set; } = default!;
        public DbSet<AsientoContable> AsientosContables { get; set; } = default!;
        public DbSet<AsientoDetalle> AsientosDetalles { get; set; } = default!;
        public DbSet<AuditoriaContable> AuditoriasContables { get; set; } = default!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 0. MULTI-EMPRESA (MULTI-TENANT): tabla intermedia Usuario<->Empresa
            // Clave compuesta (UsuarioId, EmpresaId) + índices y borrado en cascada.
            modelBuilder.Entity<UsuarioEmpresa>(entity =>
            {
                entity.HasKey(ue => new { ue.UsuarioId, ue.EmpresaId });

                entity.HasOne(ue => ue.Usuario)
                      .WithMany(u => u.EmpresasAsignadas)
                      .HasForeignKey(ue => ue.UsuarioId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(ue => ue.Empresa)
                      .WithMany()
                      .HasForeignKey(ue => ue.EmpresaId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(ue => ue.EmpresaId);
            });

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

            // --- FISCAL: CONCEPTOS DE OPERACIÓN (puente UI ↔ plan de cuentas) ---
            modelBuilder.Entity<ConceptoOperacional>()
                .HasIndex(c => new { c.EmpresaId, c.NombreConcepto })
                .IsUnique();

            modelBuilder.Entity<ConceptoOperacional>()
                .HasOne(c => c.Empresa)
                .WithMany()
                .HasForeignKey(c => c.EmpresaId)
                .OnDelete(DeleteBehavior.Restrict);

            // Gasto → concepto (borrado en cascada del enlace, no del gasto)
            modelBuilder.Entity<Gasto>()
                .HasOne(g => g.ConceptoOperacional)
                .WithMany()
                .HasForeignKey(g => g.ConceptoOperacionalId)
                .OnDelete(DeleteBehavior.SetNull);

            // Línea de venta fiscal → concepto de ingreso
            modelBuilder.Entity<VentaDetalle>()
                .HasOne(d => d.ConceptoOperacional)
                .WithMany()
                .HasForeignKey(d => d.ConceptoOperacionalId)
                .OnDelete(DeleteBehavior.SetNull);

            // Resumen de ventas de la máquina fiscal (índice de consulta del libro)
            modelBuilder.Entity<ResumenVentaFiscal>()
                .HasIndex(r => new { r.EmpresaId, r.Fecha });

            // Retención de ISLR: UNA sola retención VIGENTE (Estado='Emitida')
            // por documento origen. El índice único filtrado convive con las
            // retenciones anuladas (Estado='Anulada' no compite en el índice),
            // de modo que tras anular mal se pueda re-emitir sin duplicados.
            modelBuilder.Entity<RetencionIslrEmitida>()
                .HasIndex(r => r.CompraId)
                .IsUnique()
                .HasFilter("[CompraId] IS NOT NULL AND [Estado] = 'Emitida'");

            modelBuilder.Entity<RetencionIslrEmitida>()
                .HasIndex(r => r.GastoId)
                .IsUnique()
                .HasFilter("[GastoId] IS NOT NULL AND [Estado] = 'Emitida'");

            // 3. CONFIGURACIÓN DE RELACIONES Y SEEDING (Omitido para brevedad, mantener igual)
            // ... (Tus relaciones y DataSeed de Usuario, Empresa, etc.)
        }
    }
}