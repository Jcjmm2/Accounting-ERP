using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDualidadFiscal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BaseImponibleBs",
                table: "RetencionesIvaEmitidas",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "IvaCalculadoBs",
                table: "RetencionesIvaEmitidas",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MontoFacturaBs",
                table: "RetencionesIvaEmitidas",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MontoRetenidoBs",
                table: "RetencionesIvaEmitidas",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "IvaMonedaExt",
                table: "Gastos",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MontoMonedaExt",
                table: "Gastos",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TasaDeCambio",
                table: "Gastos",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            // ------------------------------------------------------------------
            // BACKFILL HISTÓRICO (Inmutabilidad Fiscal): rellena los montos en
            // Bolívares de los documentos antiguos para evitar ceros/nulos.
            // Gastos: se asume tasa 1 (monto histórico ya tratado como unidad).
            // ------------------------------------------------------------------
            migrationBuilder.Sql(
                "UPDATE Gastos SET TasaDeCambio = 1, MontoMonedaExt = Monto WHERE MontoMonedaExt = 0");

            // Retenciones de IVA: deriva los montos en Bs. desde la compra origen
            // usando la TASA CONGELADA de la factura (nunca la del día). Fallback
            // a IvaMonedaBase × Tasa cuando la compra no tiene MonedaExt diligenciada.
            migrationBuilder.Sql(@"
                UPDATE r
                SET r.MontoFacturaBs = CASE WHEN c.TotalMonedaExt > 0 THEN c.TotalMonedaExt
                    ELSE ROUND(c.TotalMonedaBase * ISNULL(NULLIF(c.TasaDeCambio, 0), 1), 4) END,
                    r.BaseImponibleBs = CASE WHEN c.SubtotalMonedaExt > 0 THEN c.SubtotalMonedaExt
                    ELSE ROUND(c.SubtotalMonedaBase * ISNULL(NULLIF(c.TasaDeCambio, 0), 1), 4) END,
                    r.IvaCalculadoBs = CASE WHEN c.IvaMonedaExt > 0 THEN c.IvaMonedaExt
                    ELSE ROUND(c.IvaMonedaBase * ISNULL(NULLIF(c.TasaDeCambio, 0), 1), 4) END,
                    r.MontoRetenidoBs = ROUND(
                        (CASE WHEN c.IvaMonedaExt > 0 THEN c.IvaMonedaExt
                              ELSE ROUND(c.IvaMonedaBase * ISNULL(NULLIF(c.TasaDeCambio, 0), 1), 4) END)
                        * r.PorcentajeRetencion / 100.0, 2)
                FROM RetencionesIvaEmitidas r
                INNER JOIN Compras c ON r.CompraId = c.Id
                WHERE r.MontoRetenidoBs = 0");

            migrationBuilder.CreateTable(
                name: "RetencionesIslrEmitidas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    CompraId = table.Column<int>(type: "int", nullable: true),
                    FechaRetencion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NumeroComprobante = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProveedorRif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ProveedorNombre = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    NumeroFactura = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NumeroControl = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BaseImponibleBs = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PorcentajeRetencion = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    MontoRetenidoBs = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    MontoRetenidoUsd = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RetencionesIslrEmitidas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RetencionesIslrEmitidas_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_CompraId",
                table: "RetencionesIslrEmitidas",
                column: "CompraId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "BaseImponibleBs",
                table: "RetencionesIvaEmitidas");

            migrationBuilder.DropColumn(
                name: "IvaCalculadoBs",
                table: "RetencionesIvaEmitidas");

            migrationBuilder.DropColumn(
                name: "MontoFacturaBs",
                table: "RetencionesIvaEmitidas");

            migrationBuilder.DropColumn(
                name: "MontoRetenidoBs",
                table: "RetencionesIvaEmitidas");

            migrationBuilder.DropColumn(
                name: "IvaMonedaExt",
                table: "Gastos");

            migrationBuilder.DropColumn(
                name: "MontoMonedaExt",
                table: "Gastos");

            migrationBuilder.DropColumn(
                name: "TasaDeCambio",
                table: "Gastos");
        }
    }
}
