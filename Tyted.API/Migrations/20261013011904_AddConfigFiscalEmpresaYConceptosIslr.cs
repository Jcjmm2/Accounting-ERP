using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddConfigFiscalEmpresaYConceptosIslr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TasaRetencionIvaDefecto",
                table: "Empresa",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "AplicaSustraendo",
                table: "ConceptosOperacionales",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CodigoSeniat",
                table: "ConceptosOperacionales",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MontoSustraendoBs",
                table: "ConceptosOperacionales",
                type: "decimal(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PorcentajeRetencion",
                table: "ConceptosOperacionales",
                type: "decimal(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TipoPersona",
                table: "ConceptosOperacionales",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TasaRetencionIvaDefecto",
                table: "Empresa");

            migrationBuilder.DropColumn(
                name: "AplicaSustraendo",
                table: "ConceptosOperacionales");

            migrationBuilder.DropColumn(
                name: "CodigoSeniat",
                table: "ConceptosOperacionales");

            migrationBuilder.DropColumn(
                name: "MontoSustraendoBs",
                table: "ConceptosOperacionales");

            migrationBuilder.DropColumn(
                name: "PorcentajeRetencion",
                table: "ConceptosOperacionales");

            migrationBuilder.DropColumn(
                name: "TipoPersona",
                table: "ConceptosOperacionales");
        }
    }
}
