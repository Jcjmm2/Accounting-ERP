using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddOrigenYGastosFiscales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Origen",
                table: "Ventas",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Origen",
                table: "Compras",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            // BACKFILL: las filas existentes nacían sin Origen (NULL). Sin este
            // UPDATE, "Origen != 'Fiscal'" en SQL evalúa NULL y el arqueo de
            // caja perdería todas las ventas anteriores; el historial POS con
            // filtro origen='POS' tampoco las mostraría.
            migrationBuilder.Sql("UPDATE Ventas SET Origen = 'POS' WHERE Origen IS NULL");
            migrationBuilder.Sql("UPDATE Compras SET Origen = 'COMPRAS' WHERE Origen IS NULL");

            migrationBuilder.CreateTable(
                name: "Gastos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Concepto = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Categoria = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CodigoProv = table.Column<int>(type: "int", nullable: true),
                    Monto = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TipoTransaccion = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    Origen = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    AsientoContableId = table.Column<int>(type: "int", nullable: true),
                    IsAnulada = table.Column<bool>(type: "bit", nullable: false),
                    Usuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Gastos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Gastos_Proveedores_CodigoProv",
                        column: x => x.CodigoProv,
                        principalTable: "Proveedores",
                        principalColumn: "CodigoProv");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Gastos_CodigoProv",
                table: "Gastos",
                column: "CodigoProv");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Gastos");

            migrationBuilder.DropColumn(
                name: "Origen",
                table: "Ventas");

            migrationBuilder.DropColumn(
                name: "Origen",
                table: "Compras");
        }
    }
}
