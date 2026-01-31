using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPedidoIdToVenta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PedidoId",
                table: "Ventas",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PedidosDetalle_IdProductoUnidad",
                table: "PedidosDetalle",
                column: "IdProductoUnidad");

            migrationBuilder.AddForeignKey(
                name: "FK_PedidosDetalle_ProductosUnidad_IdProductoUnidad",
                table: "PedidosDetalle",
                column: "IdProductoUnidad",
                principalTable: "ProductosUnidad",
                principalColumn: "IdProductoUnidad",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PedidosDetalle_ProductosUnidad_IdProductoUnidad",
                table: "PedidosDetalle");

            migrationBuilder.DropIndex(
                name: "IX_PedidosDetalle_IdProductoUnidad",
                table: "PedidosDetalle");

            migrationBuilder.DropColumn(
                name: "PedidoId",
                table: "Ventas");
        }
    }
}
