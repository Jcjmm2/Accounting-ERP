using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarCategoriasEIVAIniciales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TasaIVA",
                table: "Productos");

            migrationBuilder.AddColumn<int>(
                name: "CategoriaIdCategoria",
                table: "Productos",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IdCategoria",
                table: "Productos",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "IdTasaIVA",
                table: "Productos",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TasaIVAIdTasaIVA",
                table: "Productos",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Categorias",
                columns: table => new
                {
                    IdCategoria = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PorcentajeMargen = table.Column<decimal>(type: "decimal(5,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categorias", x => x.IdCategoria);
                });

            migrationBuilder.CreateTable(
                name: "TasasIVA",
                columns: table => new
                {
                    IdTasaIVA = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Porcentaje = table.Column<decimal>(type: "decimal(5,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TasasIVA", x => x.IdTasaIVA);
                });

            migrationBuilder.InsertData(
                table: "Categorias",
                columns: new[] { "IdCategoria", "Nombre", "PorcentajeMargen" },
                values: new object[,]
                {
                    { 1, "Víveres Básicos", 15.00m },
                    { 2, "Artículos de Higiene", 30.00m },
                    { 3, "Snacks y Golosinas", 35.00m }
                });

            migrationBuilder.InsertData(
                table: "TasasIVA",
                columns: new[] { "IdTasaIVA", "Nombre", "Porcentaje" },
                values: new object[,]
                {
                    { 1, "Exento (0%)", 0.00m },
                    { 2, "Tasa Reducida (8%)", 8.00m },
                    { 3, "Tasa General (16%)", 16.00m },
                    { 4, "Tasa Adicional (31%)", 31.00m }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Productos_CategoriaIdCategoria",
                table: "Productos",
                column: "CategoriaIdCategoria");

            migrationBuilder.CreateIndex(
                name: "IX_Productos_TasaIVAIdTasaIVA",
                table: "Productos",
                column: "TasaIVAIdTasaIVA");

            migrationBuilder.AddForeignKey(
                name: "FK_Productos_Categorias_CategoriaIdCategoria",
                table: "Productos",
                column: "CategoriaIdCategoria",
                principalTable: "Categorias",
                principalColumn: "IdCategoria");

            migrationBuilder.AddForeignKey(
                name: "FK_Productos_TasasIVA_TasaIVAIdTasaIVA",
                table: "Productos",
                column: "TasaIVAIdTasaIVA",
                principalTable: "TasasIVA",
                principalColumn: "IdTasaIVA");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Productos_Categorias_CategoriaIdCategoria",
                table: "Productos");

            migrationBuilder.DropForeignKey(
                name: "FK_Productos_TasasIVA_TasaIVAIdTasaIVA",
                table: "Productos");

            migrationBuilder.DropTable(
                name: "Categorias");

            migrationBuilder.DropTable(
                name: "TasasIVA");

            migrationBuilder.DropIndex(
                name: "IX_Productos_CategoriaIdCategoria",
                table: "Productos");

            migrationBuilder.DropIndex(
                name: "IX_Productos_TasaIVAIdTasaIVA",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "CategoriaIdCategoria",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "IdCategoria",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "IdTasaIVA",
                table: "Productos");

            migrationBuilder.DropColumn(
                name: "TasaIVAIdTasaIVA",
                table: "Productos");

            migrationBuilder.AddColumn<double>(
                name: "TasaIVA",
                table: "Productos",
                type: "float",
                nullable: false,
                defaultValue: 0.0);
        }
    }
}
