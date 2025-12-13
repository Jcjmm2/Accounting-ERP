using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarTablasDeCompras : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Compras",
                columns: table => new
                {
                    IdCompra = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FechaDocumento = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NumDocumento = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TasaCambio = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TipoDoc = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CodigoProv = table.Column<int>(type: "int", nullable: false),
                    ProveedorCodigoProv = table.Column<int>(type: "int", nullable: true),
                    SubTotalMonedaBase = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalImpuestoMonedaBase = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalCompraMonedaBase = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Compras", x => x.IdCompra);
                    table.ForeignKey(
                        name: "FK_Compras_Proveedores_ProveedorCodigoProv",
                        column: x => x.ProveedorCodigoProv,
                        principalTable: "Proveedores",
                        principalColumn: "CodigoProv");
                });

            migrationBuilder.CreateTable(
                name: "ComprasDetalle",
                columns: table => new
                {
                    IdCompraDetalle = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdCompra = table.Column<int>(type: "int", nullable: false),
                    CompraIdCompra = table.Column<int>(type: "int", nullable: true),
                    CodigoProd = table.Column<int>(type: "int", nullable: false),
                    ProductoCodigoProd = table.Column<int>(type: "int", nullable: true),
                    IdProductoUnidad = table.Column<int>(type: "int", nullable: false),
                    ProductoUnidadIdProductoUnidad = table.Column<int>(type: "int", nullable: true),
                    CantidadComprada = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CostoUnitarioMonedaBase = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CostoUnitarioMonedaExt = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalLineaMonedaBase = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComprasDetalle", x => x.IdCompraDetalle);
                    table.ForeignKey(
                        name: "FK_ComprasDetalle_Compras_CompraIdCompra",
                        column: x => x.CompraIdCompra,
                        principalTable: "Compras",
                        principalColumn: "IdCompra");
                    table.ForeignKey(
                        name: "FK_ComprasDetalle_ProductosUnidad_ProductoUnidadIdProductoUnidad",
                        column: x => x.ProductoUnidadIdProductoUnidad,
                        principalTable: "ProductosUnidad",
                        principalColumn: "IdProductoUnidad");
                    table.ForeignKey(
                        name: "FK_ComprasDetalle_Productos_ProductoCodigoProd",
                        column: x => x.ProductoCodigoProd,
                        principalTable: "Productos",
                        principalColumn: "CodigoProd");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Compras_ProveedorCodigoProv",
                table: "Compras",
                column: "ProveedorCodigoProv");

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_CompraIdCompra",
                table: "ComprasDetalle",
                column: "CompraIdCompra");

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_ProductoCodigoProd",
                table: "ComprasDetalle",
                column: "ProductoCodigoProd");

            migrationBuilder.CreateIndex(
                name: "IX_ComprasDetalle_ProductoUnidadIdProductoUnidad",
                table: "ComprasDetalle",
                column: "ProductoUnidadIdProductoUnidad");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComprasDetalle");

            migrationBuilder.DropTable(
                name: "Compras");
        }
    }
}
