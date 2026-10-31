using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class TrazabilidadAsientosAutomaticos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OrigenGeneracion",
                table: "AsientosContables",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Manual");

            migrationBuilder.AddColumn<int>(
                name: "PeriodoOrigenId",
                table: "AsientosContables",
                type: "integer",
                nullable: true);

            // Reclasificar los automáticos históricos ya reconocidos por el
            // sistema. Todo lo demás permanece Manual y editable.
            migrationBuilder.Sql("""
                UPDATE "AsientosContables"
                SET "OrigenGeneracion" = 'TrasladoApertura'
                WHERE "TipoComprobante" = 'Apertura'
                  AND "Concepto" LIKE 'APERTURA DE BALANCE%';

                UPDATE "AsientosContables"
                SET "OrigenGeneracion" = 'CierreResultados',
                    "PeriodoOrigenId" = "PeriodoContableId"
                WHERE "TipoComprobante" = 'Cierre'
                  AND "Concepto" LIKE 'CIERRE DE RESULTADOS%';
                """);

            // Conciliar el origen legado sólo cuando el encabezado completo
            // APERTURA DE BALANCE {Nombre}: produce UNA coincidencia dentro de
            // la empresa y antes del periodo destino. Los ambiguos quedan NULL.
            migrationBuilder.Sql("""
                UPDATE "AsientosContables" AS a
                SET "PeriodoOrigenId" = conciliado."PeriodoId"
                FROM (
                    SELECT coincidencias."AsientoId", MIN(coincidencias."PeriodoId") AS "PeriodoId"
                    FROM (
                        SELECT a2."Id" AS "AsientoId", p."Id" AS "PeriodoId"
                        FROM "AsientosContables" AS a2
                        INNER JOIN "PeriodosContables" AS destino
                            ON destino."Id" = a2."PeriodoContableId"
                        INNER JOIN "PeriodosContables" AS p
                            ON p."EmpresaId" = a2."EmpresaId"
                           AND p."Id" <> a2."PeriodoContableId"
                           AND p."FechaFin" < destino."FechaInicio"
                           AND p."Nombre" IS NOT NULL
                           AND LEFT(
                                a2."Concepto",
                                LENGTH('APERTURA DE BALANCE ' || p."Nombre" || ':')
                           ) = 'APERTURA DE BALANCE ' || p."Nombre" || ':'
                        WHERE a2."OrigenGeneracion" = 'TrasladoApertura'
                    ) AS coincidencias
                    GROUP BY coincidencias."AsientoId"
                    HAVING COUNT(*) = 1
                ) AS conciliado
                WHERE a."Id" = conciliado."AsientoId";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_AsientosContables_PeriodoOrigenId",
                table: "AsientosContables",
                column: "PeriodoOrigenId");

            migrationBuilder.AddForeignKey(
                name: "FK_AsientosContables_PeriodosContables_PeriodoOrigenId",
                table: "AsientosContables",
                column: "PeriodoOrigenId",
                principalTable: "PeriodosContables",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AsientosContables_PeriodosContables_PeriodoOrigenId",
                table: "AsientosContables");

            migrationBuilder.DropIndex(
                name: "IX_AsientosContables_PeriodoOrigenId",
                table: "AsientosContables");

            migrationBuilder.DropColumn(
                name: "OrigenGeneracion",
                table: "AsientosContables");

            migrationBuilder.DropColumn(
                name: "PeriodoOrigenId",
                table: "AsientosContables");
        }
    }
}
