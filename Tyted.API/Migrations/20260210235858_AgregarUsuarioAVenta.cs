using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarUsuarioAVenta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "CodigoProd",
                table: "PedidosDetalle",
                type: "nvarchar(100)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PedidosDetalle_CodigoProd",
                table: "PedidosDetalle",
                column: "CodigoProd");

            migrationBuilder.AddForeignKey(
                name: "FK_PedidosDetalle_Productos_CodigoProd",
                table: "PedidosDetalle",
                column: "CodigoProd",
                principalTable: "Productos",
                principalColumn: "CodigoProd");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PedidosDetalle_Productos_CodigoProd",
                table: "PedidosDetalle");

            migrationBuilder.DropIndex(
                name: "IX_PedidosDetalle_CodigoProd",
                table: "PedidosDetalle");

            migrationBuilder.AlterColumn<string>(
                name: "CodigoProd",
                table: "PedidosDetalle",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldNullable: true);
        }
    }
}
