using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDatosFiscalesGastoIslrYSujecionConcepto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "GastoId",
                table: "RetencionesIslrEmitidas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NumeroControl",
                table: "Gastos",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NumeroFactura",
                table: "Gastos",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AplicaRetencionIslr",
                table: "ConceptosOperacionales",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ConceptoIslrSugeridoId",
                table: "ConceptosOperacionales",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_GastoId",
                table: "RetencionesIslrEmitidas",
                column: "GastoId");

            migrationBuilder.CreateIndex(
                name: "IX_ConceptosOperacionales_ConceptoIslrSugeridoId",
                table: "ConceptosOperacionales",
                column: "ConceptoIslrSugeridoId");

            migrationBuilder.AddForeignKey(
                name: "FK_ConceptosOperacionales_ConceptosOperacionales_ConceptoIslrSugeridoId",
                table: "ConceptosOperacionales",
                column: "ConceptoIslrSugeridoId",
                principalTable: "ConceptosOperacionales",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RetencionesIslrEmitidas_Gastos_GastoId",
                table: "RetencionesIslrEmitidas",
                column: "GastoId",
                principalTable: "Gastos",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ConceptosOperacionales_ConceptosOperacionales_ConceptoIslrSugeridoId",
                table: "ConceptosOperacionales");

            migrationBuilder.DropForeignKey(
                name: "FK_RetencionesIslrEmitidas_Gastos_GastoId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropIndex(
                name: "IX_RetencionesIslrEmitidas_GastoId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropIndex(
                name: "IX_ConceptosOperacionales_ConceptoIslrSugeridoId",
                table: "ConceptosOperacionales");

            migrationBuilder.DropColumn(
                name: "GastoId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "NumeroControl",
                table: "Gastos");

            migrationBuilder.DropColumn(
                name: "NumeroFactura",
                table: "Gastos");

            migrationBuilder.DropColumn(
                name: "AplicaRetencionIslr",
                table: "ConceptosOperacionales");

            migrationBuilder.DropColumn(
                name: "ConceptoIslrSugeridoId",
                table: "ConceptosOperacionales");
        }
    }
}
