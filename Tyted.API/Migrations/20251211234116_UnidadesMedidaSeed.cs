using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class UnidadesMedidaSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "UnidadesMedida",
                columns: new[] { "IdUnidad", "NombreUnidad" },
                values: new object[,]
                {
                    { 1, "Unidad" },
                    { 2, "Caja" },
                    { 3, "Paquete" },
                    { 4, "Kilogramo" },
                    { 5, "Litro" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "UnidadesMedida",
                keyColumn: "IdUnidad",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "UnidadesMedida",
                keyColumn: "IdUnidad",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "UnidadesMedida",
                keyColumn: "IdUnidad",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "UnidadesMedida",
                keyColumn: "IdUnidad",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "UnidadesMedida",
                keyColumn: "IdUnidad",
                keyValue: 5);
        }
    }
}
