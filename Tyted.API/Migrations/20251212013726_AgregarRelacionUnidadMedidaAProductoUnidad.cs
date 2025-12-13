using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarRelacionUnidadMedidaAProductoUnidad : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductosUnidad_Productos_CodigoProd",
                table: "ProductosUnidad");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductosUnidad_UnidadesMedida_IdUnidad",
                table: "ProductosUnidad");

            migrationBuilder.DropIndex(
                name: "IX_ProductosUnidad_CodigoProd",
                table: "ProductosUnidad");

            migrationBuilder.DropIndex(
                name: "IX_ProductosUnidad_IdUnidad",
                table: "ProductosUnidad");

            migrationBuilder.AlterColumn<decimal>(
                name: "CantidadEquivalente",
                table: "ProductosUnidad",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "NombreUnidad",
                table: "ProductosUnidad",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ProductoCodigoProd",
                table: "ProductosUnidad",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UnidadMedidaIdUnidad",
                table: "ProductosUnidad",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_ProductoCodigoProd",
                table: "ProductosUnidad",
                column: "ProductoCodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_UnidadMedidaIdUnidad",
                table: "ProductosUnidad",
                column: "UnidadMedidaIdUnidad");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductosUnidad_Productos_ProductoCodigoProd",
                table: "ProductosUnidad",
                column: "ProductoCodigoProd",
                principalTable: "Productos",
                principalColumn: "CodigoProd");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductosUnidad_UnidadesMedida_UnidadMedidaIdUnidad",
                table: "ProductosUnidad",
                column: "UnidadMedidaIdUnidad",
                principalTable: "UnidadesMedida",
                principalColumn: "IdUnidad");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductosUnidad_Productos_ProductoCodigoProd",
                table: "ProductosUnidad");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductosUnidad_UnidadesMedida_UnidadMedidaIdUnidad",
                table: "ProductosUnidad");

            migrationBuilder.DropIndex(
                name: "IX_ProductosUnidad_ProductoCodigoProd",
                table: "ProductosUnidad");

            migrationBuilder.DropIndex(
                name: "IX_ProductosUnidad_UnidadMedidaIdUnidad",
                table: "ProductosUnidad");

            migrationBuilder.DropColumn(
                name: "NombreUnidad",
                table: "ProductosUnidad");

            migrationBuilder.DropColumn(
                name: "ProductoCodigoProd",
                table: "ProductosUnidad");

            migrationBuilder.DropColumn(
                name: "UnidadMedidaIdUnidad",
                table: "ProductosUnidad");

            migrationBuilder.AlterColumn<int>(
                name: "CantidadEquivalente",
                table: "ProductosUnidad",
                type: "int",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_CodigoProd",
                table: "ProductosUnidad",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_IdUnidad",
                table: "ProductosUnidad",
                column: "IdUnidad");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductosUnidad_Productos_CodigoProd",
                table: "ProductosUnidad",
                column: "CodigoProd",
                principalTable: "Productos",
                principalColumn: "CodigoProd",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductosUnidad_UnidadesMedida_IdUnidad",
                table: "ProductosUnidad",
                column: "IdUnidad",
                principalTable: "UnidadesMedida",
                principalColumn: "IdUnidad",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
