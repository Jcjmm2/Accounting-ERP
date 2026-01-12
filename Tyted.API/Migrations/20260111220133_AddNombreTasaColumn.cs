using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNombreTasaColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pedidos_Clientes_ClienteId",
                table: "Pedidos");

            migrationBuilder.DropForeignKey(
                name: "FK_Ventas_Clientes_ClienteId",
                table: "Ventas");

            migrationBuilder.AlterColumn<int>(
                name: "ClienteId",
                table: "Ventas",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NombreTasa",
                table: "TasaDeCambio",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ClienteId",
                table: "Pedidos",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "CajaSesiones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FechaApertura = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaCierre = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MontoAperturaUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    MontoCierreEfectivoUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    MontoCierrePagoMovilUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    ObservacionesCierre = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Usuario = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsAbierta = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CajaSesiones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VentasPagos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VentaId = table.Column<int>(type: "int", nullable: false),
                    MetodoPago = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MontoMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    MontoMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TasaDeCambio = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_VentasPagos_VentaId",
                table: "VentasPagos",
                column: "VentaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Pedidos_Clientes_ClienteId",
                table: "Pedidos",
                column: "ClienteId",
                principalTable: "Clientes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Ventas_Clientes_ClienteId",
                table: "Ventas",
                column: "ClienteId",
                principalTable: "Clientes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pedidos_Clientes_ClienteId",
                table: "Pedidos");

            migrationBuilder.DropForeignKey(
                name: "FK_Ventas_Clientes_ClienteId",
                table: "Ventas");

            migrationBuilder.DropTable(
                name: "CajaSesiones");

            migrationBuilder.DropTable(
                name: "VentasPagos");

            migrationBuilder.DropColumn(
                name: "NombreTasa",
                table: "TasaDeCambio");

            migrationBuilder.AlterColumn<int>(
                name: "ClienteId",
                table: "Ventas",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "ClienteId",
                table: "Pedidos",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddForeignKey(
                name: "FK_Pedidos_Clientes_ClienteId",
                table: "Pedidos",
                column: "ClienteId",
                principalTable: "Clientes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Ventas_Clientes_ClienteId",
                table: "Ventas",
                column: "ClienteId",
                principalTable: "Clientes",
                principalColumn: "Id");
        }
    }
}
