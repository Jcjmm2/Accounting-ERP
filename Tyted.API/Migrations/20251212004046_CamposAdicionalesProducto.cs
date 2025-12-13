using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class CamposAdicionalesProducto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Productos_Proveedores_CodigoProv",
                table: "Productos");

            migrationBuilder.DropIndex(
                name: "IX_Productos_CodigoProv",
                table: "Productos");

            migrationBuilder.AlterColumn<decimal>(
                name: "StockActual",
                table: "Productos",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "CodigoBarras",
                table: "Productos",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaAdquisicion",
                table: "Productos",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaVencimiento",
                table: "Productos",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProveedorCodigoProv",
                table: "Productos",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Productos_ProveedorCodigoProv",
                table: "Productos",
                column: "ProveedorCodigoProv");

            migrationBuilder.AddForeignKey(
                name: "FK_Productos_Proveedores_ProveedorCodigoProv",
                table: "Productos",
                column: "ProveedorCodigoProv",
                principalTable: "Proveedores",
                principalColumn: "CodigoProv");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Productos_Proveedores_ProveedorCodigoProv",
                table: "Productos");

            migrationBuilder.DropIndex(
                name: "IX_Productos_ProveedorCodigoProv",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "CodigoBarras",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "FechaAdquisicion",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "FechaVencimiento",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "ProveedorCodigoProv",
                table: "Productos");

            migrationBuilder.AlterColumn<int>(
                name: "StockActual",
                table: "Productos",
                type: "int",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_CodigoProv",
                table: "Productos",
                column: "CodigoProv");

            migrationBuilder.AddForeignKey(
                name: "FK_Productos_Proveedores_CodigoProv",
                table: "Productos",
                column: "CodigoProv",
                principalTable: "Proveedores",
                principalColumn: "CodigoProv",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
