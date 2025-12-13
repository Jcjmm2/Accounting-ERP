using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class InventarioInicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UnidadesMedida",
                columns: table => new
                {
                    IdUnidad = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NombreUnidad = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadesMedida", x => x.IdUnidad);
                });

            migrationBuilder.CreateTable(
                name: "Productos",
                columns: table => new
                {
                    CodigoProd = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Descripcion = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    TipoArt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    StockActual = table.Column<int>(type: "int", nullable: false),
                    CodigoProv = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Productos", x => x.CodigoProd);
                    table.ForeignKey(
                        name: "FK_Productos_Proveedores_CodigoProv",
                        column: x => x.CodigoProv,
                        principalTable: "Proveedores",
                        principalColumn: "CodigoProv",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProductosUnidad",
                columns: table => new
                {
                    IdProductoUnidad = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CodigoProd = table.Column<int>(type: "int", nullable: false),
                    IdUnidad = table.Column<int>(type: "int", nullable: false),
                    CantidadEquivalente = table.Column<int>(type: "int", nullable: false),
                    CostoUnitarioMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PrecioMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CostoUnitarioMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PrecioMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductosUnidad", x => x.IdProductoUnidad);
                    table.ForeignKey(
                        name: "FK_ProductosUnidad_Productos_CodigoProd",
                        column: x => x.CodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductosUnidad_UnidadesMedida_IdUnidad",
                        column: x => x.IdUnidad,
                        principalTable: "UnidadesMedida",
                        principalColumn: "IdUnidad",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Productos_CodigoProv",
                table: "Productos",
                column: "CodigoProv");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_CodigoProd",
                table: "ProductosUnidad",
                column: "CodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_ProductosUnidad_IdUnidad",
                table: "ProductosUnidad",
                column: "IdUnidad");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductosUnidad");

            migrationBuilder.DropTable(
                name: "Productos");

            migrationBuilder.DropTable(
                name: "UnidadesMedida");

            migrationBuilder.DropTable(
                name: "Proveedores");
        }
    }
}
