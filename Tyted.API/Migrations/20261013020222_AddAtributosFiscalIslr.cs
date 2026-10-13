using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAtributosFiscalIslr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodigoConcepto",
                table: "RetencionesIslrEmitidas",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConceptoOperacionalId",
                table: "RetencionesIslrEmitidas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SustraendoBs",
                table: "RetencionesIslrEmitidas",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_ConceptoOperacionalId",
                table: "RetencionesIslrEmitidas",
                column: "ConceptoOperacionalId");

            migrationBuilder.AddForeignKey(
                name: "FK_RetencionesIslrEmitidas_ConceptosOperacionales_ConceptoOperacionalId",
                table: "RetencionesIslrEmitidas",
                column: "ConceptoOperacionalId",
                principalTable: "ConceptosOperacionales",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RetencionesIslrEmitidas_ConceptosOperacionales_ConceptoOperacionalId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropIndex(
                name: "IX_RetencionesIslrEmitidas_ConceptoOperacionalId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "CodigoConcepto",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "ConceptoOperacionalId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "SustraendoBs",
                table: "RetencionesIslrEmitidas");
        }
    }
}
