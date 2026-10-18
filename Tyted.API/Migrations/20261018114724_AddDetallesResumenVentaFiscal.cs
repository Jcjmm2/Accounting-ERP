using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDetallesResumenVentaFiscal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ResumenesVentasFiscalesDetalles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ResumenVentaFiscalId = table.Column<int>(type: "int", nullable: false),
                    TasaIVA = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    BaseBs = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    IvaBs = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResumenesVentasFiscalesDetalles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResumenesVentasFiscalesDetalles_ResumenesVentasFiscales_ResumenVentaFiscalId",
                        column: x => x.ResumenVentaFiscalId,
                        principalTable: "ResumenesVentasFiscales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResumenesVentasFiscalesDetalles_ResumenVentaFiscalId",
                table: "ResumenesVentasFiscalesDetalles",
                column: "ResumenVentaFiscalId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResumenesVentasFiscalesDetalles");
        }
    }
}
