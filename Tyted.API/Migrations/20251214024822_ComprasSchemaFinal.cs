using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class ComprasSchemaFinal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ComprasDetalle_Compras_CompraIdCompra",
                table: "ComprasDetalle");

            migrationBuilder.DropForeignKey(
                name: "FK_ComprasDetalle_ProductosUnidad_ProductoUnidadIdProductoUnidad",
                table: "ComprasDetalle");

            migrationBuilder.DropIndex(
                name: "IX_ComprasDetalle_CompraIdCompra",
                table: "ComprasDetalle");

            migrationBuilder.DropIndex(
                name: "IX_ComprasDetalle_ProductoUnidadIdProductoUnidad",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "CantidadComprada",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "CompraIdCompra",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "ProductoUnidadIdProductoUnidad",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "NumDocumento",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "TipoDoc",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "TotalCompraMonedaBase",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "TotalImpuestoMonedaBase",
                table: "Compras");

            migrationBuilder.RenameColumn(
                name: "IdCompra",
                table: "ComprasDetalle",
                newName: "CompraId");

            migrationBuilder.RenameColumn(
                name: "CostoUnitarioMonedaExt",
                table: "ComprasDetalle",
                newName: "Cantidad");

            migrationBuilder.RenameColumn(
                name: "IdCompraDetalle",
                table: "ComprasDetalle",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "SubTotalMonedaBase",
                table: "Compras",
                newName: "SubtotalMonedaBase");

            migrationBuilder.RenameColumn(
                name: "FechaDocumento",
                table: "Compras",
                newName: "FechaCompra");

            migrationBuilder.RenameColumn(
                name: "IdCompra",
                table: "Compras",
                newName: "Id");

            migrationBuilder.AddColumn<double>(
                name: "TasaIVA",
                table: "Productos",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalLineaMonedaBase",
                table: "ComprasDetalle",
                type: "decimal(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AddColumn<decimal>(
                name: "TasaIVA",
                table: "ComprasDetalle",
                type: "decimal(5,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "SubtotalMonedaBase",
                table: "Compras",
                type: "decimal(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AddColumn<decimal>(
                name: "IvaMonedaBase",
                table: "Compras",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "IvaMonedaExt",
                table: "Compras",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SubtotalMonedaExt",
                table: "Compras",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "TipoMoneda",
                table: "Compras",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "TotalMonedaBase",
                table: "Compras",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalMonedaExt",
                table: "Compras",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_CompraId",
                table: "ComprasDetalle",
                column: "CompraId");

            migrationBuilder.AddForeignKey(
                name: "FK_ComprasDetalle_Compras_CompraId",
                table: "ComprasDetalle",
                column: "CompraId",
                principalTable: "Compras",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ComprasDetalle_Compras_CompraId",
                table: "ComprasDetalle");

            migrationBuilder.DropIndex(
                name: "IX_ComprasDetalle_CompraId",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "TasaIVA",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "TasaIVA",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "IvaMonedaBase",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "IvaMonedaExt",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "SubtotalMonedaExt",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "TipoMoneda",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "TotalMonedaBase",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "TotalMonedaExt",
                table: "Compras");

            migrationBuilder.RenameColumn(
                name: "CompraId",
                table: "ComprasDetalle",
                newName: "IdCompra");

            migrationBuilder.RenameColumn(
                name: "Cantidad",
                table: "ComprasDetalle",
                newName: "CostoUnitarioMonedaExt");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "ComprasDetalle",
                newName: "IdCompraDetalle");

            migrationBuilder.RenameColumn(
                name: "SubtotalMonedaBase",
                table: "Compras",
                newName: "SubTotalMonedaBase");

            migrationBuilder.RenameColumn(
                name: "FechaCompra",
                table: "Compras",
                newName: "FechaDocumento");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "Compras",
                newName: "IdCompra");

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalLineaMonedaBase",
                table: "ComprasDetalle",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,4)");

            migrationBuilder.AddColumn<decimal>(
                name: "CantidadComprada",
                table: "ComprasDetalle",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "CompraIdCompra",
                table: "ComprasDetalle",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductoUnidadIdProductoUnidad",
                table: "ComprasDetalle",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "SubTotalMonedaBase",
                table: "Compras",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,4)");

            migrationBuilder.AddColumn<string>(
                name: "NumDocumento",
                table: "Compras",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TipoDoc",
                table: "Compras",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCompraMonedaBase",
                table: "Compras",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalImpuestoMonedaBase",
                table: "Compras",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_CompraIdCompra",
                table: "ComprasDetalle",
                column: "CompraIdCompra");

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_ProductoUnidadIdProductoUnidad",
                table: "ComprasDetalle",
                column: "ProductoUnidadIdProductoUnidad");

            migrationBuilder.AddForeignKey(
                name: "FK_ComprasDetalle_Compras_CompraIdCompra",
                table: "ComprasDetalle",
                column: "CompraIdCompra",
                principalTable: "Compras",
                principalColumn: "IdCompra");

            migrationBuilder.AddForeignKey(
                name: "FK_ComprasDetalle_ProductosUnidad_ProductoUnidadIdProductoUnidad",
                table: "ComprasDetalle",
                column: "ProductoUnidadIdProductoUnidad",
                principalTable: "ProductosUnidad",
                principalColumn: "IdProductoUnidad");
        }
    }
}
