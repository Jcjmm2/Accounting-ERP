using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarMaestroMaquinasFiscales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaquinaFiscalId",
                table: "ResumenesVentasFiscales",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MaquinasFiscales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<int>(type: "integer", nullable: false),
                    NumeroControl = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Alias = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    MarcaModelo = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    NumeroZInicial = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    FacturaInicial = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Activa = table.Column<bool>(type: "boolean", nullable: false),
                    EsPredeterminada = table.Column<bool>(type: "boolean", nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaquinasFiscales", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResumenesVentasFiscales_MaquinaFiscalId",
                table: "ResumenesVentasFiscales",
                column: "MaquinaFiscalId");

            migrationBuilder.CreateIndex(
                name: "IX_MaquinasFiscales_EmpresaId_EsPredeterminada_Alias",
                table: "MaquinasFiscales",
                columns: new[] { "EmpresaId", "EsPredeterminada", "Alias" });

            migrationBuilder.CreateIndex(
                name: "IX_MaquinasFiscales_EmpresaId_NumeroControl",
                table: "MaquinasFiscales",
                columns: new[] { "EmpresaId", "NumeroControl" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ResumenesVentasFiscales_MaquinasFiscales_MaquinaFiscalId",
                table: "ResumenesVentasFiscales",
                column: "MaquinaFiscalId",
                principalTable: "MaquinasFiscales",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ResumenesVentasFiscales_MaquinasFiscales_MaquinaFiscalId",
                table: "ResumenesVentasFiscales");

            migrationBuilder.DropTable(
                name: "MaquinasFiscales");

            migrationBuilder.DropIndex(
                name: "IX_ResumenesVentasFiscales_MaquinaFiscalId",
                table: "ResumenesVentasFiscales");

            migrationBuilder.DropColumn(
                name: "MaquinaFiscalId",
                table: "ResumenesVentasFiscales");
        }
    }
}
