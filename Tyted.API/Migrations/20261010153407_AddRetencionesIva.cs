using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRetencionesIva : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RetencionesIvaEmitidas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    CompraId = table.Column<int>(type: "int", nullable: true),
                    FechaRetencion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NumeroComprobante = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProveedorRif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ProveedorNombre = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    NumeroFactura = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NumeroControl = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MontoFactura = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    BaseImponible = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaCalculado = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PorcentajeRetencion = table.Column<int>(type: "int", nullable: false),
                    MontoRetenido = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RetencionesIvaEmitidas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RetencionesIvaEmitidas_Compras_CompraId",
                        column: x => x.CompraId,
                        principalTable: "Compras",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIvaEmitidas_CompraId",
                table: "RetencionesIvaEmitidas",
                column: "CompraId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RetencionesIvaEmitidas");
        }
    }
}
