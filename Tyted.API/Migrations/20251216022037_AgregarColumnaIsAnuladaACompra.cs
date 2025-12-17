using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarColumnaIsAnuladaACompra : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Compras_Proveedores_ProveedorCodigoProv",
                table: "Compras");

            migrationBuilder.DropIndex(
                name: "IX_Compras_ProveedorCodigoProv",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "ProveedorCodigoProv",
                table: "Compras");

            migrationBuilder.AddColumn<bool>(
                name: "IsAnulada",
                table: "Compras",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Compras_CodigoProv",
                table: "Compras",
                column: "CodigoProv");

            migrationBuilder.AddForeignKey(
                name: "FK_Compras_Proveedores_CodigoProv",
                table: "Compras",
                column: "CodigoProv",
                principalTable: "Proveedores",
                principalColumn: "CodigoProv",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Compras_Proveedores_CodigoProv",
                table: "Compras");

            migrationBuilder.DropIndex(
                name: "IX_Compras_CodigoProv",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "IsAnulada",
                table: "Compras");

            migrationBuilder.AddColumn<int>(
                name: "ProveedorCodigoProv",
                table: "Compras",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Compras_ProveedorCodigoProv",
                table: "Compras",
                column: "ProveedorCodigoProv");

            migrationBuilder.AddForeignKey(
                name: "FK_Compras_Proveedores_ProveedorCodigoProv",
                table: "Compras",
                column: "ProveedorCodigoProv",
                principalTable: "Proveedores",
                principalColumn: "CodigoProv");
        }
    }
}
