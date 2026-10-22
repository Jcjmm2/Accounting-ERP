using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AbonosCXC",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CuentaPorCobrarId = table.Column<int>(type: "integer", nullable: false),
                    FechaAbono = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    MontoAbonadoMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    MetodoPago = table.Column<string>(type: "text", nullable: true),
                    Notas = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AbonosCXC", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CajaSesiones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FechaApertura = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaCierre = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    MontoAperturaUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    MontoCierreEfectivoUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    MontoCierrePagoMovilUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    ObservacionesCierre = table.Column<string>(type: "text", nullable: true),
                    Usuario = table.Column<string>(type: "text", nullable: true),
                    IsAbierta = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CajaSesiones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categorias",
                columns: table => new
                {
                    IdCategoria = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PorcentajeMargen = table.Column<decimal>(type: "numeric(5,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categorias", x => x.IdCategoria);
                });

            migrationBuilder.CreateTable(
                name: "Clientes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Rif = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Direccion = table.Column<string>(type: "text", nullable: true),
                    Telefono = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    PermitirCredito = table.Column<bool>(type: "boolean", nullable: false),
                    LimiteCreditoUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clientes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CuentasContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    CodigoCuenta = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    NombreCuenta = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TipoCuenta = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Naturaleza = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    EsMovimiento = table.Column<bool>(type: "boolean", nullable: false),
                    Nivel = table.Column<int>(type: "integer", nullable: false),
                    PadreCuentaId = table.Column<int>(type: "integer", nullable: true),
                    AceptaTerceros = table.Column<bool>(type: "boolean", nullable: false),
                    AceptaCentroCosto = table.Column<bool>(type: "boolean", nullable: false),
                    Activa = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CuentasContables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CuentasContables_CuentasContables_PadreCuentaId",
                        column: x => x.PadreCuentaId,
                        principalTable: "CuentasContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Empresa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RazonSocial = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RIF = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Direccion = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Telefono = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Email = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TipoContribuyente = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TasaRetencionIvaDefecto = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    LeyendaFactura = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Empresa", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmpresaConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Clave = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Valor = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmpresaConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Monedas",
                columns: table => new
                {
                    IdMoneda = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Siglas = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Nombre = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EsMonedaBase = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Monedas", x => x.IdMoneda);
                });

            migrationBuilder.CreateTable(
                name: "NotasEntregaCompra",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NumeroNota = table.Column<string>(type: "text", nullable: true),
                    ProveedorId = table.Column<int>(type: "integer", nullable: false),
                    FechaRecepcion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TotalEstimadoUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    ProcesadoAFactura = table.Column<bool>(type: "boolean", nullable: false),
                    IdProductoUnidad = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotasEntregaCompra", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PeriodosContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: true),
                    Nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TipoPeriodo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PeriodoPadreId = table.Column<int>(type: "integer", nullable: true),
                    FechaInicio = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaFin = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Cerrado = table.Column<bool>(type: "boolean", nullable: false),
                    FechaCierre = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    UsuarioCierre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PeriodosContables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PeriodosContables_PeriodosContables_PeriodoPadreId",
                        column: x => x.PeriodoPadreId,
                        principalTable: "PeriodosContables",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Proveedores",
                columns: table => new
                {
                    CodigoProv = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Razonsocial = table.Column<string>(type: "text", nullable: false),
                    Contacto = table.Column<string>(type: "text", nullable: true),
                    RIF = table.Column<string>(type: "text", nullable: false),
                    PersonaISLR = table.Column<string>(type: "text", nullable: true),
                    Telefono = table.Column<string>(type: "text", nullable: true),
                    Direccion = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    Cuentaasociadaconta = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Proveedores", x => x.CodigoProv);
                });

            migrationBuilder.CreateTable(
                name: "ResumenesVentasFiscales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NumeroControlMaquina = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    NumeroZ = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FacturaDesde = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FacturaHasta = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Exento = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    BaseGravada = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Iva = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Total = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TipoTransaccion = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Origen = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: true),
                    IsAnulada = table.Column<bool>(type: "boolean", nullable: false),
                    Usuario = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResumenesVentasFiscales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TasaDeCambio",
                columns: table => new
                {
                    IdTasa = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Tasa = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    FechaVigencia = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NombreTasa = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MonedaOrigen = table.Column<string>(type: "text", nullable: true),
                    MonedaDestino = table.Column<string>(type: "text", nullable: true),
                    FactorSugerido = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    UsuarioRegistro = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TasaDeCambio", x => x.IdTasa);
                });

            migrationBuilder.CreateTable(
                name: "TasasIVA",
                columns: table => new
                {
                    IdTasaIVA = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Porcentaje = table.Column<decimal>(type: "numeric(5,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TasasIVA", x => x.IdTasaIVA);
                });

            migrationBuilder.CreateTable(
                name: "UnidadesMedida",
                columns: table => new
                {
                    IdUnidad = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NombreUnidad = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadesMedida", x => x.IdUnidad);
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    NombreCompleto = table.Column<string>(type: "text", nullable: true),
                    Rol = table.Column<string>(type: "text", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    EmpresaPredeterminadaId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pedidos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ClienteId = table.Column<int>(type: "integer", nullable: false),
                    MontoTotalUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pedidos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pedidos_Clientes_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Clientes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Ventas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FechaVenta = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TipoMoneda = table.Column<string>(type: "text", nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IsAnulada = table.Column<bool>(type: "boolean", nullable: false),
                    NumeroFactura = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ClienteId = table.Column<int>(type: "integer", nullable: false),
                    MetodoPago = table.Column<string>(type: "text", nullable: true),
                    Usuario = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TasaDia = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    TotalUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    TotalVES = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    EsCredito = table.Column<bool>(type: "boolean", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    PedidoId = table.Column<int>(type: "integer", nullable: true),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    TipoTransaccion = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    NumeroControl = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: true),
                    Origen = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ventas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Ventas_Clientes_ClienteId",
                        column: x => x.ClienteId,
                        principalTable: "Clientes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConceptosOperacionales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    NombreConcepto = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TipoOperacion = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CuentaContable = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CodigoSeniat = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    TipoPersona = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: true),
                    PorcentajeRetencion = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    AplicaSustraendo = table.Column<bool>(type: "boolean", nullable: false),
                    MontoSustraendoBs = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    AplicaRetencionIslr = table.Column<bool>(type: "boolean", nullable: false),
                    ConceptoIslrSugeridoId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConceptosOperacionales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConceptosOperacionales_ConceptosOperacionales_ConceptoIslrS~",
                        column: x => x.ConceptoIslrSugeridoId,
                        principalTable: "ConceptosOperacionales",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConceptosOperacionales_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "NotasEntregaCompraDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NotaEntregaCompraId = table.Column<int>(type: "integer", nullable: false),
                    CodigoProd = table.Column<string>(type: "text", nullable: true),
                    CantidadRecibida = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CostoUnitarioUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotasEntregaCompraDetalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotasEntregaCompraDetalle_NotasEntregaCompra_NotaEntregaCom~",
                        column: x => x.NotaEntregaCompraId,
                        principalTable: "NotasEntregaCompra",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AsientosContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    PeriodoContableId = table.Column<int>(type: "integer", nullable: false),
                    NumeroComprobante = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FechaComprobante = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Concepto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    TipoComprobante = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Estado = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    UsuarioId = table.Column<int>(type: "integer", nullable: false),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TotalDebe = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalHaber = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AsientosContables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AsientosContables_PeriodosContables_PeriodoContableId",
                        column: x => x.PeriodoContableId,
                        principalTable: "PeriodosContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Compras",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CodigoProv = table.Column<int>(type: "integer", nullable: false),
                    FechaCompra = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TipoMoneda = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IsAnulada = table.Column<bool>(type: "boolean", nullable: false),
                    NumeroFactura = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    NumeroControl = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    AplicaLibroCompras = table.Column<bool>(type: "boolean", nullable: false),
                    EsGastoServicio = table.Column<bool>(type: "boolean", nullable: false),
                    EsCredito = table.Column<bool>(type: "boolean", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    AsientoPagoId = table.Column<int>(type: "integer", nullable: true),
                    FechaPago = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    TipoTransaccion = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: true),
                    Origen = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true)
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
                name: "ResumenesVentasFiscalesDetalles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ResumenVentaFiscalId = table.Column<int>(type: "integer", nullable: false),
                    TasaIVA = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    BaseBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResumenesVentasFiscalesDetalles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResumenesVentasFiscalesDetalles_ResumenesVentasFiscales_Res~",
                        column: x => x.ResumenVentaFiscalId,
                        principalTable: "ResumenesVentasFiscales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Productos",
                columns: table => new
                {
                    CodigoProd = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IdCategoria = table.Column<int>(type: "integer", nullable: false),
                    IdTasaIVA = table.Column<int>(type: "integer", nullable: false),
                    CodigoProv = table.Column<int>(type: "integer", nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(510)", maxLength: 510, nullable: false),
                    TipoArt = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CostoUnitarioBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    StockActual = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    StockMinimo = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CodigoBarras = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FechaVencimiento = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    FechaAdquisicion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ImpuestoLicorPorcentaje = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    ManejaImpuestoLicor = table.Column<bool>(type: "boolean", nullable: true),
                    PermiteDesglose = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Productos", x => x.CodigoProd);
                    table.ForeignKey(
                        name: "FK_Productos_Categorias_IdCategoria",
                        column: x => x.IdCategoria,
                        principalTable: "Categorias",
                        principalColumn: "IdCategoria",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Productos_Proveedores_CodigoProv",
                        column: x => x.CodigoProv,
                        principalTable: "Proveedores",
                        principalColumn: "CodigoProv",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Productos_TasasIVA_IdTasaIVA",
                        column: x => x.IdTasaIVA,
                        principalTable: "TasasIVA",
                        principalColumn: "IdTasaIVA",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UsuariosEmpresas",
                columns: table => new
                {
                    UsuarioId = table.Column<int>(type: "integer", nullable: false),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsuariosEmpresas", x => new { x.UsuarioId, x.EmpresaId });
                    table.ForeignKey(
                        name: "FK_UsuariosEmpresas_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UsuariosEmpresas_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CuentasPorCobrar",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VentaId = table.Column<int>(type: "integer", nullable: false),
                    MontoTotalUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SaldoPendienteUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    FechaEmision = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: true)
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
                name: "VentasPagos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VentaId = table.Column<int>(type: "integer", nullable: false),
                    MetodoPago = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MontoMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    MontoMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VentasPagos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VentasPagos_Ventas_VentaId",
                        column: x => x.VentaId,
                        principalTable: "Ventas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Gastos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Concepto = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Categoria = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ConceptoOperacionalId = table.Column<int>(type: "integer", nullable: true),
                    CodigoProv = table.Column<int>(type: "integer", nullable: true),
                    Monto = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    MontoMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    NumeroFactura = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    NumeroControl = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    TipoTransaccion = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Origen = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: true),
                    IsAnulada = table.Column<bool>(type: "boolean", nullable: false),
                    Usuario = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Gastos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Gastos_ConceptosOperacionales_ConceptoOperacionalId",
                        column: x => x.ConceptoOperacionalId,
                        principalTable: "ConceptosOperacionales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Gastos_Proveedores_CodigoProv",
                        column: x => x.CodigoProv,
                        principalTable: "Proveedores",
                        principalColumn: "CodigoProv");
                });

            migrationBuilder.CreateTable(
                name: "AsientosDetalles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: false),
                    CuentaContableId = table.Column<int>(type: "integer", nullable: false),
                    Referencia = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Debe = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Haber = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AsientosDetalles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AsientosDetalles_AsientosContables_AsientoContableId",
                        column: x => x.AsientoContableId,
                        principalTable: "AsientosContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AsientosDetalles_CuentasContables_CuentaContableId",
                        column: x => x.CuentaContableId,
                        principalTable: "CuentasContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditoriasContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Usuario = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Accion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Detalle = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditoriasContables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditoriasContables_AsientosContables_AsientoContableId",
                        column: x => x.AsientoContableId,
                        principalTable: "AsientosContables",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CuentasPorPagar",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompraId = table.Column<int>(type: "integer", nullable: false),
                    MontoTotalUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SaldoPendienteUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaVencimiento = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: true)
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
                name: "RetencionesIvaEmitidas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    CompraId = table.Column<int>(type: "integer", nullable: true),
                    FechaRetencion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NumeroComprobante = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProveedorRif = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ProveedorNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    NumeroFactura = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    NumeroControl = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MontoFactura = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    BaseImponible = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaCalculado = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    PorcentajeRetencion = table.Column<int>(type: "integer", nullable: false),
                    MontoRetenido = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: true),
                    MontoFacturaBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    BaseImponibleBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaCalculadoBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    MontoRetenidoBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RetencionesIvaEmitidas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RetencionesIvaEmitidas_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ComprasDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompraId = table.Column<int>(type: "integer", nullable: false),
                    UnidadCompra = table.Column<string>(type: "text", nullable: false),
                    CodigoProd = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IdProductoUnidad = table.Column<int>(type: "integer", nullable: false),
                    Cantidad = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CostoUnitarioMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalLineaMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalLineaMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CostoUnitarioMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalLineaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaLineaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalLineaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TasaIVA = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
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
                    IdMovimiento = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CodigoProd = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Concepto = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Cantidad = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CostoUnitarioUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CompraId = table.Column<int>(type: "integer", nullable: true)
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
                    IdProductoUnidad = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CodigoProd = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IdUnidad = table.Column<int>(type: "integer", nullable: false),
                    NombreUnidad = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CantidadEquivalente = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    CostoUnitarioMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    PrecioMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    CostoUnitarioMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    PrecioMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    CodigoBarras = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Margen1 = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    Margen2 = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    Margen3 = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    Precio2MonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    Precio3MonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    Precio2MonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    Precio3MonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: true)
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
                name: "RetencionesIslrEmitidas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    CompraId = table.Column<int>(type: "integer", nullable: true),
                    GastoId = table.Column<int>(type: "integer", nullable: true),
                    FechaRetencion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    NumeroComprobante = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProveedorRif = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ProveedorNombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    NumeroFactura = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    NumeroControl = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    BaseImponibleBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    ConceptoOperacionalId = table.Column<int>(type: "integer", nullable: true),
                    CodigoConcepto = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    SustraendoBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    PorcentajeRetencion = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    MontoRetenidoBs = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    MontoRetenidoUsd = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AsientoContableId = table.Column<int>(type: "integer", nullable: true),
                    AsientoReversoId = table.Column<int>(type: "integer", nullable: true),
                    FechaAnulacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    MotivoAnulacion = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RetencionesIslrEmitidas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RetencionesIslrEmitidas_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RetencionesIslrEmitidas_ConceptosOperacionales_ConceptoOper~",
                        column: x => x.ConceptoOperacionalId,
                        principalTable: "ConceptosOperacionales",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RetencionesIslrEmitidas_Gastos_GastoId",
                        column: x => x.GastoId,
                        principalTable: "Gastos",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PedidosDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PedidoId = table.Column<int>(type: "integer", nullable: true),
                    CodigoProd = table.Column<string>(type: "character varying(100)", nullable: true),
                    Cantidad = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    PrecioUnitarioUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    SubtotalUSD = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    IdProductoUnidad = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PedidosDetalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PedidosDetalle_Pedidos_PedidoId",
                        column: x => x.PedidoId,
                        principalTable: "Pedidos",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PedidosDetalle_ProductosUnidad_IdProductoUnidad",
                        column: x => x.IdProductoUnidad,
                        principalTable: "ProductosUnidad",
                        principalColumn: "IdProductoUnidad",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PedidosDetalle_Productos_CodigoProd",
                        column: x => x.CodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd");
                });

            migrationBuilder.CreateTable(
                name: "VentasDetalle",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VentaId = table.Column<int>(type: "integer", nullable: false),
                    CodigoProd = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IdProductoUnidad = table.Column<int>(type: "integer", nullable: true),
                    NombreUnidad = table.Column<string>(type: "text", nullable: true),
                    ConceptoOperacionalId = table.Column<int>(type: "integer", nullable: true),
                    DescripcionFiscal = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Cantidad = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TasaIVA = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    PrecioUnitarioMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalLineaMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalLineaMonedaBase = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    PrecioUnitarioMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    SubtotalLineaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    IvaLineaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    TotalLineaMonedaExt = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VentasDetalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VentasDetalle_ConceptosOperacionales_ConceptoOperacionalId",
                        column: x => x.ConceptoOperacionalId,
                        principalTable: "ConceptosOperacionales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_VentasDetalle_ProductosUnidad_IdProductoUnidad",
                        column: x => x.IdProductoUnidad,
                        principalTable: "ProductosUnidad",
                        principalColumn: "IdProductoUnidad");
                    table.ForeignKey(
                        name: "FK_VentasDetalle_Productos_CodigoProd",
                        column: x => x.CodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd");
                    table.ForeignKey(
                        name: "FK_VentasDetalle_Ventas_VentaId",
                        column: x => x.VentaId,
                        principalTable: "Ventas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AsientosContables_PeriodoContableId",
                table: "AsientosContables",
                column: "PeriodoContableId");

            migrationBuilder.CreateIndex(
                name: "IX_AsientosDetalles_AsientoContableId",
                table: "AsientosDetalles",
                column: "AsientoContableId");

            migrationBuilder.CreateIndex(
                name: "IX_AsientosDetalles_CuentaContableId",
                table: "AsientosDetalles",
                column: "CuentaContableId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditoriasContables_AsientoContableId",
                table: "AuditoriasContables",
                column: "AsientoContableId");

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_Rif",
                table: "Clientes",
                column: "Rif",
                unique: true);

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
                name: "IX_ConceptosOperacionales_ConceptoIslrSugeridoId",
                table: "ConceptosOperacionales",
                column: "ConceptoIslrSugeridoId");

            migrationBuilder.CreateIndex(
                name: "IX_ConceptosOperacionales_EmpresaId_NombreConcepto",
                table: "ConceptosOperacionales",
                columns: new[] { "EmpresaId", "NombreConcepto" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CuentasContables_EmpresaId_CodigoCuenta",
                table: "CuentasContables",
                columns: new[] { "EmpresaId", "CodigoCuenta" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CuentasContables_PadreCuentaId",
                table: "CuentasContables",
                column: "PadreCuentaId");

            migrationBuilder.CreateIndex(
                name: "IX_CuentasPorCobrar_VentaId",
                table: "CuentasPorCobrar",
                column: "VentaId");

            migrationBuilder.CreateIndex(
                name: "IX_CuentasPorPagar_CompraId",
                table: "CuentasPorPagar",
                column: "CompraId");

            migrationBuilder.CreateIndex(
                name: "IX_Gastos_CodigoProv",
                table: "Gastos",
                column: "CodigoProv");

            migrationBuilder.CreateIndex(
                name: "IX_Gastos_ConceptoOperacionalId",
                table: "Gastos",
                column: "ConceptoOperacionalId");

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
                name: "IX_Pedidos_ClienteId",
                table: "Pedidos",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_PedidosDetalle_CodigoProd",
                table: "PedidosDetalle",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_PedidosDetalle_IdProductoUnidad",
                table: "PedidosDetalle",
                column: "IdProductoUnidad");

            migrationBuilder.CreateIndex(
                name: "IX_PedidosDetalle_PedidoId",
                table: "PedidosDetalle",
                column: "PedidoId");

            migrationBuilder.CreateIndex(
                name: "IX_PeriodosContables_EmpresaId_Anio_Mes",
                table: "PeriodosContables",
                columns: new[] { "EmpresaId", "Anio", "Mes" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PeriodosContables_PeriodoPadreId",
                table: "PeriodosContables",
                column: "PeriodoPadreId");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_CodigoProv",
                table: "Productos",
                column: "CodigoProv");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_IdCategoria",
                table: "Productos",
                column: "IdCategoria");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_IdTasaIVA",
                table: "Productos",
                column: "IdTasaIVA");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_CodigoProd",
                table: "ProductosUnidad",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_IdUnidad",
                table: "ProductosUnidad",
                column: "IdUnidad");

            migrationBuilder.CreateIndex(
                name: "IX_ResumenesVentasFiscales_EmpresaId_Fecha",
                table: "ResumenesVentasFiscales",
                columns: new[] { "EmpresaId", "Fecha" });

            migrationBuilder.CreateIndex(
                name: "IX_ResumenesVentasFiscalesDetalles_ResumenVentaFiscalId",
                table: "ResumenesVentasFiscalesDetalles",
                column: "ResumenVentaFiscalId");

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_CompraId",
                table: "RetencionesIslrEmitidas",
                column: "CompraId",
                unique: true,
                filter: "\"CompraId\" IS NOT NULL AND \"Estado\" = 'Emitida'");

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_ConceptoOperacionalId",
                table: "RetencionesIslrEmitidas",
                column: "ConceptoOperacionalId");

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_GastoId",
                table: "RetencionesIslrEmitidas",
                column: "GastoId",
                unique: true,
                filter: "\"GastoId\" IS NOT NULL AND \"Estado\" = 'Emitida'");

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIvaEmitidas_CompraId",
                table: "RetencionesIvaEmitidas",
                column: "CompraId");

            migrationBuilder.CreateIndex(
                name: "IX_UsuariosEmpresas_EmpresaId",
                table: "UsuariosEmpresas",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_Ventas_ClienteId",
                table: "Ventas",
                column: "ClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_VentasDetalle_CodigoProd",
                table: "VentasDetalle",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_VentasDetalle_ConceptoOperacionalId",
                table: "VentasDetalle",
                column: "ConceptoOperacionalId");

            migrationBuilder.CreateIndex(
                name: "IX_VentasDetalle_IdProductoUnidad",
                table: "VentasDetalle",
                column: "IdProductoUnidad");

            migrationBuilder.CreateIndex(
                name: "IX_VentasDetalle_VentaId",
                table: "VentasDetalle",
                column: "VentaId");

            migrationBuilder.CreateIndex(
                name: "IX_VentasPagos_VentaId",
                table: "VentasPagos",
                column: "VentaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AbonosCXC");

            migrationBuilder.DropTable(
                name: "AsientosDetalles");

            migrationBuilder.DropTable(
                name: "AuditoriasContables");

            migrationBuilder.DropTable(
                name: "CajaSesiones");

            migrationBuilder.DropTable(
                name: "ComprasDetalle");

            migrationBuilder.DropTable(
                name: "CuentasPorCobrar");

            migrationBuilder.DropTable(
                name: "CuentasPorPagar");

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
                name: "ResumenesVentasFiscalesDetalles");

            migrationBuilder.DropTable(
                name: "RetencionesIslrEmitidas");

            migrationBuilder.DropTable(
                name: "RetencionesIvaEmitidas");

            migrationBuilder.DropTable(
                name: "TasaDeCambio");

            migrationBuilder.DropTable(
                name: "UsuariosEmpresas");

            migrationBuilder.DropTable(
                name: "VentasDetalle");

            migrationBuilder.DropTable(
                name: "VentasPagos");

            migrationBuilder.DropTable(
                name: "CuentasContables");

            migrationBuilder.DropTable(
                name: "AsientosContables");

            migrationBuilder.DropTable(
                name: "NotasEntregaCompra");

            migrationBuilder.DropTable(
                name: "Pedidos");

            migrationBuilder.DropTable(
                name: "ResumenesVentasFiscales");

            migrationBuilder.DropTable(
                name: "Gastos");

            migrationBuilder.DropTable(
                name: "Compras");

            migrationBuilder.DropTable(
                name: "Usuarios");

            migrationBuilder.DropTable(
                name: "ProductosUnidad");

            migrationBuilder.DropTable(
                name: "Ventas");

            migrationBuilder.DropTable(
                name: "PeriodosContables");

            migrationBuilder.DropTable(
                name: "ConceptosOperacionales");

            migrationBuilder.DropTable(
                name: "Productos");

            migrationBuilder.DropTable(
                name: "UnidadesMedida");

            migrationBuilder.DropTable(
                name: "Clientes");

            migrationBuilder.DropTable(
                name: "Empresa");

            migrationBuilder.DropTable(
                name: "Categorias");

            migrationBuilder.DropTable(
                name: "Proveedores");

            migrationBuilder.DropTable(
                name: "TasasIVA");
        }
    }
}
