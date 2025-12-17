using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AgregarCamposMonedaExtDetalleCompra_Final : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- CÓDIGO ELIMINADO: Se asume que el renombramiento ya ocurrió ---
            // migrationBuilder.DropPrimaryKey(name: "PK_TasasDeCambio", table: "TasasDeCambio");
            // migrationBuilder.RenameTable(name: "TasasDeCambio", newName: "TasaDeCambio");
            // -------------------------------------------------------------------
            
            migrationBuilder.AddColumn<decimal>(
                name: "CostoUnitarioMonedaExt",
                table: "ComprasDetalle",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "IvaLineaMonedaExt",
                table: "ComprasDetalle",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SubtotalLineaMonedaBase",
                table: "ComprasDetalle",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);
            
            // Nota: Este campo 'SubtotalLineaMonedaBase' parece ser una adición nueva,
            // si ya existía en la DB, puede eliminar esta línea. Lo dejaremos.

            migrationBuilder.AddColumn<decimal>(
                name: "SubtotalLineaMonedaExt",
                table: "ComprasDetalle",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalLineaMonedaExt",
                table: "ComprasDetalle",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            // --- CÓDIGO ELIMINADO: Se asume que la PK ya se definió correctamente ---
            // migrationBuilder.AddPrimaryKey(name: "PK_TasaDeCambio", table: "TasaDeCambio", column: "IdTasa");
            // -----------------------------------------------------------------------
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // --- CÓDIGO ELIMINADO en Down() ---
            // migrationBuilder.DropPrimaryKey(name: "PK_TasaDeCambio", table: "TasaDeCambio");
            // -----------------------------------

            migrationBuilder.DropColumn(
                name: "CostoUnitarioMonedaExt",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "IvaLineaMonedaExt",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "SubtotalLineaMonedaBase",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "SubtotalLineaMonedaExt",
                table: "ComprasDetalle");

            migrationBuilder.DropColumn(
                name: "TotalLineaMonedaExt",
                table: "ComprasDetalle");

            // --- CÓDIGO ELIMINADO en Down() ---
            // migrationBuilder.RenameTable(name: "TasaDeCambio", newName: "TasasDeCambio");
            // migrationBuilder.AddPrimaryKey(name: "PK_TasasDeCambio", table: "TasasDeCambio", column: "IdTasa");
            // -----------------------------------
        }
    }
}
