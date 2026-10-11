using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddConceptosOperacionalesYResumenVentas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Las BDs legacy creadas con EnsureCreated pueden no tener estas
            // constraints (o llamarlas distinto): se eliminan SOLO si existen.
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_VentasDetalle_ProductosUnidad_IdProductoUnidad' AND parent_object_id = OBJECT_ID(N'[dbo].[VentasDetalle]'))
    ALTER TABLE [VentasDetalle] DROP CONSTRAINT [FK_VentasDetalle_ProductosUnidad_IdProductoUnidad];");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_VentasDetalle_Productos_CodigoProd' AND parent_object_id = OBJECT_ID(N'[dbo].[VentasDetalle]'))
    ALTER TABLE [VentasDetalle] DROP CONSTRAINT [FK_VentasDetalle_Productos_CodigoProd];");

            migrationBuilder.AlterColumn<int>(
                name: "IdProductoUnidad",
                table: "VentasDetalle",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "CodigoProd",
                table: "VentasDetalle",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<int>(
                name: "ConceptoOperacionalId",
                table: "VentasDetalle",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescripcionFiscal",
                table: "VentasDetalle",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConceptoOperacionalId",
                table: "Gastos",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ConceptosOperacionales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    NombreConcepto = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    TipoOperacion = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CuentaContable = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConceptosOperacionales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConceptosOperacionales_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ResumenesVentasFiscales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NumeroControlMaquina = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    NumeroZ = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    FacturaDesde = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FacturaHasta = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Exento = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    BaseGravada = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Iva = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Total = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TipoTransaccion = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    Origen = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    AsientoContableId = table.Column<int>(type: "int", nullable: true),
                    IsAnulada = table.Column<bool>(type: "bit", nullable: false),
                    Usuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResumenesVentasFiscales", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VentasDetalle_ConceptoOperacionalId",
                table: "VentasDetalle",
                column: "ConceptoOperacionalId");

            migrationBuilder.CreateIndex(
                name: "IX_Gastos_ConceptoOperacionalId",
                table: "Gastos",
                column: "ConceptoOperacionalId");

            migrationBuilder.CreateIndex(
                name: "IX_ConceptosOperacionales_EmpresaId_NombreConcepto",
                table: "ConceptosOperacionales",
                columns: new[] { "EmpresaId", "NombreConcepto" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResumenesVentasFiscales_EmpresaId_Fecha",
                table: "ResumenesVentasFiscales",
                columns: new[] { "EmpresaId", "Fecha" });

            migrationBuilder.AddForeignKey(
                name: "FK_Gastos_ConceptosOperacionales_ConceptoOperacionalId",
                table: "Gastos",
                column: "ConceptoOperacionalId",
                principalTable: "ConceptosOperacionales",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_VentasDetalle_ConceptosOperacionales_ConceptoOperacionalId",
                table: "VentasDetalle",
                column: "ConceptoOperacionalId",
                principalTable: "ConceptosOperacionales",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_VentasDetalle_ProductosUnidad_IdProductoUnidad",
                table: "VentasDetalle",
                column: "IdProductoUnidad",
                principalTable: "ProductosUnidad",
                principalColumn: "IdProductoUnidad");

            migrationBuilder.AddForeignKey(
                name: "FK_VentasDetalle_Productos_CodigoProd",
                table: "VentasDetalle",
                column: "CodigoProd",
                principalTable: "Productos",
                principalColumn: "CodigoProd");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Gastos_ConceptosOperacionales_ConceptoOperacionalId",
                table: "Gastos");

            migrationBuilder.DropForeignKey(
                name: "FK_VentasDetalle_ConceptosOperacionales_ConceptoOperacionalId",
                table: "VentasDetalle");

            migrationBuilder.DropForeignKey(
                name: "FK_VentasDetalle_ProductosUnidad_IdProductoUnidad",
                table: "VentasDetalle");

            migrationBuilder.DropForeignKey(
                name: "FK_VentasDetalle_Productos_CodigoProd",
                table: "VentasDetalle");

            migrationBuilder.DropTable(
                name: "ConceptosOperacionales");

            migrationBuilder.DropTable(
                name: "ResumenesVentasFiscales");

            migrationBuilder.DropIndex(
                name: "IX_VentasDetalle_ConceptoOperacionalId",
                table: "VentasDetalle");

            migrationBuilder.DropIndex(
                name: "IX_Gastos_ConceptoOperacionalId",
                table: "Gastos");

            migrationBuilder.DropColumn(
                name: "ConceptoOperacionalId",
                table: "VentasDetalle");

            migrationBuilder.DropColumn(
                name: "DescripcionFiscal",
                table: "VentasDetalle");

            migrationBuilder.DropColumn(
                name: "ConceptoOperacionalId",
                table: "Gastos");

            migrationBuilder.AlterColumn<int>(
                name: "IdProductoUnidad",
                table: "VentasDetalle",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CodigoProd",
                table: "VentasDetalle",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_VentasDetalle_ProductosUnidad_IdProductoUnidad",
                table: "VentasDetalle",
                column: "IdProductoUnidad",
                principalTable: "ProductosUnidad",
                principalColumn: "IdProductoUnidad",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_VentasDetalle_Productos_CodigoProd",
                table: "VentasDetalle",
                column: "CodigoProd",
                principalTable: "Productos",
                principalColumn: "CodigoProd",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
