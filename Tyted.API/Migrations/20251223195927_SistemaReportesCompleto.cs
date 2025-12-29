using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class SistemaReportesCompleto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AbonosCXC",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CuentaPorCobrarId = table.Column<int>(type: "int", nullable: false),
                    FechaAbono = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MontoAbonadoMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    MetodoPago = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Notas = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AbonosCXC", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categorias",
                columns: table => new
                {
                    IdCategoria = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PorcentajeMargen = table.Column<decimal>(type: "decimal(5,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categorias", x => x.IdCategoria);
                });

            migrationBuilder.CreateTable(
                name: "Empresa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RazonSocial = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RIF = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Direccion = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Telefono = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TipoContribuyente = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LeyendaFactura = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Empresa", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmpresaConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Clave = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Valor = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmpresaConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Monedas",
                columns: table => new
                {
                    IdMoneda = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Siglas = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Nombre = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EsMonedaBase = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Monedas", x => x.IdMoneda);
                });

            migrationBuilder.CreateTable(
                name: "NotasEntregaCompra",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NumeroNota = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ProveedorId = table.Column<int>(type: "int", nullable: false),
                    FechaRecepcion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalEstimadoUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    ProcesadoAFactura = table.Column<bool>(type: "bit", nullable: false),
                    IdProductoUnidad = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotasEntregaCompra", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pedidos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Cliente = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MontoTotalUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pedidos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Proveedores",
                columns: table => new
                {
                    CodigoProv = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Razonsocial = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Contacto = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RIF = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PersonaISLR = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Telefono = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Direccion = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Cuentaasociadaconta = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Proveedores", x => x.CodigoProv);
                });

            migrationBuilder.CreateTable(
                name: "TasaDeCambio",
                columns: table => new
                {
                    IdTasa = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Tasa = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    FechaVigencia = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FactorSugerido = table.Column<decimal>(type: "decimal(18,6)", nullable: true),
                    UsuarioRegistro = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MonedaOrigen = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MonedaDestino = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TasaDeCambio", x => x.IdTasa);
                });

            migrationBuilder.CreateTable(
                name: "TasasIVA",
                columns: table => new
                {
                    IdTasaIVA = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Porcentaje = table.Column<decimal>(type: "decimal(5,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TasasIVA", x => x.IdTasaIVA);
                });

            migrationBuilder.CreateTable(
                name: "UnidadesMedida",
                columns: table => new
                {
                    IdUnidad = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NombreUnidad = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadesMedida", x => x.IdUnidad);
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NombreCompleto = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Rol = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Ventas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FechaVenta = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TipoMoneda = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IsAnulada = table.Column<bool>(type: "bit", nullable: false),
                    NumeroFactura = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Cliente = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MetodoPago = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TasaDia = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    TotalUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    TotalVES = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    EsCredito = table.Column<bool>(type: "bit", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ventas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NotasEntregaCompraDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NotaEntregaCompraId = table.Column<int>(type: "int", nullable: false),
                    CodigoProd = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CantidadRecibida = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CostoUnitarioUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotasEntregaCompraDetalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotasEntregaCompraDetalle_NotasEntregaCompra_NotaEntregaCompraId",
                        column: x => x.NotaEntregaCompraId,
                        principalTable: "NotasEntregaCompra",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PedidosDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PedidoId = table.Column<int>(type: "int", nullable: true),
                    CodigoProd = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Cantidad = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    PrecioUnitarioUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    SubtotalUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PedidosDetalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PedidosDetalle_Pedidos_PedidoId",
                        column: x => x.PedidoId,
                        principalTable: "Pedidos",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Compras",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CodigoProv = table.Column<int>(type: "int", nullable: false),
                    FechaCompra = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TipoMoneda = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IsAnulada = table.Column<bool>(type: "bit", nullable: false),
                    NumeroFactura = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NumeroControl = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    AplicaLibroCompras = table.Column<bool>(type: "bit", nullable: false),
                    EsGastoServicio = table.Column<bool>(type: "bit", nullable: false),
                    EsCredito = table.Column<bool>(type: "bit", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Compras", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Compras_Proveedores_CodigoProv",
                        column: x => x.CodigoProv,
                        principalTable: "Proveedores",
                        principalColumn: "CodigoProv",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Productos",
                columns: table => new
                {
                    CodigoProd = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IdCategoria = table.Column<int>(type: "int", nullable: false),
                    CategoriaIdCategoria = table.Column<int>(type: "int", nullable: true),
                    IdTasaIVA = table.Column<int>(type: "int", nullable: false),
                    TasaIVAIdTasaIVA = table.Column<int>(type: "int", nullable: true),
                    CodigoProv = table.Column<int>(type: "int", nullable: false),
                    ProveedorCodigoProv = table.Column<int>(type: "int", nullable: true),
                    Descripcion = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    TipoArt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CostoUnitarioBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    StockActual = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    StockMinimo = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CodigoBarras = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    FechaVencimiento = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FechaAdquisicion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ImpuestoLicorPorcentaje = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    ManejaImpuestoLicor = table.Column<bool>(type: "bit", nullable: true),
                    PermiteDesglose = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Productos", x => x.CodigoProd);
                    table.ForeignKey(
                        name: "FK_Productos_Categorias_CategoriaIdCategoria",
                        column: x => x.CategoriaIdCategoria,
                        principalTable: "Categorias",
                        principalColumn: "IdCategoria");
                    table.ForeignKey(
                        name: "FK_Productos_Proveedores_ProveedorCodigoProv",
                        column: x => x.ProveedorCodigoProv,
                        principalTable: "Proveedores",
                        principalColumn: "CodigoProv");
                    table.ForeignKey(
                        name: "FK_Productos_TasasIVA_TasaIVAIdTasaIVA",
                        column: x => x.TasaIVAIdTasaIVA,
                        principalTable: "TasasIVA",
                        principalColumn: "IdTasaIVA");
                });

            migrationBuilder.CreateTable(
                name: "CuentasPorCobrar",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VentaId = table.Column<int>(type: "int", nullable: false),
                    MontoTotalUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SaldoPendienteUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    FechaEmision = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CuentasPorCobrar", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CuentasPorCobrar_Ventas_VentaId",
                        column: x => x.VentaId,
                        principalTable: "Ventas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CuentasPorPagar",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompraId = table.Column<int>(type: "int", nullable: false),
                    MontoTotalUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SaldoPendienteUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CuentasPorPagar", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CuentasPorPagar_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ComprasDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompraId = table.Column<int>(type: "int", nullable: false),
                    UnidadCompra = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CodigoProd = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IdProductoUnidad = table.Column<int>(type: "int", nullable: false),
                    Cantidad = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CostoUnitarioMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalLineaMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalLineaMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CostoUnitarioMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalLineaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaLineaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalLineaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TasaIVA = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComprasDetalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComprasDetalle_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ComprasDetalle_Productos_CodigoProd",
                        column: x => x.CodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventarioMovimientos",
                columns: table => new
                {
                    IdMovimiento = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CodigoProd = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Concepto = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Cantidad = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CostoUnitarioUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompraId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventarioMovimientos", x => x.IdMovimiento);
                    table.ForeignKey(
                        name: "FK_InventarioMovimientos_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_InventarioMovimientos_Productos_CodigoProd",
                        column: x => x.CodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProductosUnidad",
                columns: table => new
                {
                    IdProductoUnidad = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdUnidad = table.Column<int>(type: "int", nullable: false),
                    NombreUnidad = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CantidadEquivalente = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CostoUnitarioMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    PrecioMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    CostoUnitarioMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    PrecioMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    CodigoBarras = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Margen1 = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    Margen2 = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    Margen3 = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    Precio2MonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    Precio3MonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    Precio2MonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    Precio3MonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    CodigoProd = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductosUnidad", x => x.IdProductoUnidad);
                    table.ForeignKey(
                        name: "FK_ProductosUnidad_Productos_CodigoProd",
                        column: x => x.CodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductosUnidad_UnidadesMedida_IdUnidad",
                        column: x => x.IdUnidad,
                        principalTable: "UnidadesMedida",
                        principalColumn: "IdUnidad",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VentasDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VentaId = table.Column<int>(type: "int", nullable: false),
                    CodigoProd = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IdProductoUnidad = table.Column<int>(type: "int", nullable: false),
                    NombreUnidad = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Cantidad = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TasaIVA = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PrecioUnitarioMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalLineaMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalLineaMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PrecioUnitarioMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SubtotalLineaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaLineaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalLineaMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VentasDetalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VentasDetalle_Productos_CodigoProd",
                        column: x => x.CodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VentasDetalle_Ventas_VentaId",
                        column: x => x.VentaId,
                        principalTable: "Ventas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Compras_CodigoProv",
                table: "Compras",
                column: "CodigoProv");

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_CodigoProd",
                table: "ComprasDetalle",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_CompraId",
                table: "ComprasDetalle",
                column: "CompraId");

            migrationBuilder.CreateIndex(
                name: "IX_CuentasPorCobrar_VentaId",
                table: "CuentasPorCobrar",
                column: "VentaId");

            migrationBuilder.CreateIndex(
                name: "IX_CuentasPorPagar_CompraId",
                table: "CuentasPorPagar",
                column: "CompraId");

            migrationBuilder.CreateIndex(
                name: "IX_InventarioMovimientos_CodigoProd",
                table: "InventarioMovimientos",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_InventarioMovimientos_CompraId",
                table: "InventarioMovimientos",
                column: "CompraId");

            migrationBuilder.CreateIndex(
                name: "IX_NotasEntregaCompraDetalle_NotaEntregaCompraId",
                table: "NotasEntregaCompraDetalle",
                column: "NotaEntregaCompraId");

            migrationBuilder.CreateIndex(
                name: "IX_PedidosDetalle_PedidoId",
                table: "PedidosDetalle",
                column: "PedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_CategoriaIdCategoria",
                table: "Productos",
                column: "CategoriaIdCategoria");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_ProveedorCodigoProv",
                table: "Productos",
                column: "ProveedorCodigoProv");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_TasaIVAIdTasaIVA",
                table: "Productos",
                column: "TasaIVAIdTasaIVA");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_CodigoProd",
                table: "ProductosUnidad",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_IdUnidad",
                table: "ProductosUnidad",
                column: "IdUnidad");

            migrationBuilder.CreateIndex(
                name: "IX_VentasDetalle_CodigoProd",
                table: "VentasDetalle",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_VentasDetalle_VentaId",
                table: "VentasDetalle",
                column: "VentaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AbonosCXC");

            migrationBuilder.DropTable(
                name: "ComprasDetalle");

            migrationBuilder.DropTable(
                name: "CuentasPorCobrar");

            migrationBuilder.DropTable(
                name: "CuentasPorPagar");

            migrationBuilder.DropTable(
                name: "Empresa");

            migrationBuilder.DropTable(
                name: "EmpresaConfigs");

            migrationBuilder.DropTable(
                name: "InventarioMovimientos");

            migrationBuilder.DropTable(
                name: "Monedas");

            migrationBuilder.DropTable(
                name: "NotasEntregaCompraDetalle");

            migrationBuilder.DropTable(
                name: "PedidosDetalle");

            migrationBuilder.DropTable(
                name: "ProductosUnidad");

            migrationBuilder.DropTable(
                name: "TasaDeCambio");

            migrationBuilder.DropTable(
                name: "Usuarios");

            migrationBuilder.DropTable(
                name: "VentasDetalle");

            migrationBuilder.DropTable(
                name: "Compras");

            migrationBuilder.DropTable(
                name: "NotasEntregaCompra");

            migrationBuilder.DropTable(
                name: "Pedidos");

            migrationBuilder.DropTable(
                name: "UnidadesMedida");

            migrationBuilder.DropTable(
                name: "Productos");

            migrationBuilder.DropTable(
                name: "Ventas");

            migrationBuilder.DropTable(
                name: "Categorias");

            migrationBuilder.DropTable(
                name: "Proveedores");

            migrationBuilder.DropTable(
                name: "TasasIVA");
        }
    }
}
