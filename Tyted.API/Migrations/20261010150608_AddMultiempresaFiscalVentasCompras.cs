using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiempresaFiscalVentasCompras : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AsientoContableId",
                table: "Ventas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmpresaId",
                table: "Ventas",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "NumeroControl",
                table: "Ventas",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TipoTransaccion",
                table: "Ventas",
                type: "nvarchar(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AsientoContableId",
                table: "Compras",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmpresaId",
                table: "Compras",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "TipoTransaccion",
                table: "Compras",
                type: "nvarchar(2)",
                maxLength: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AsientoContableId",
                table: "Ventas");

            migrationBuilder.DropColumn(
                name: "EmpresaId",
                table: "Ventas");

            migrationBuilder.DropColumn(
                name: "NumeroControl",
                table: "Ventas");

            migrationBuilder.DropColumn(
                name: "TipoTransaccion",
                table: "Ventas");

            migrationBuilder.DropColumn(
                name: "AsientoContableId",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "EmpresaId",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "TipoTransaccion",
                table: "Compras");
        }
    }
}
