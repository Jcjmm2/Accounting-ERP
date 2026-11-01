using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Tyted.API.Data;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <summary>
    /// Migración de datos: unifica CuentasContables.Naturaleza en "D"/"C".
    /// El formulario del Plan de Cuentas guardaba "Deudora"/"Acreedora" y el
    /// plan sembrado "D"/"C"; los reportes sólo reconocían uno de los dos y
    /// mostraban con signo invertido las cuentas creadas desde la UI. No
    /// modifica el esquema.
    /// </summary>
    [DbContext(typeof(TytedContext))]
    [Migration("20261031200000_NormalizarNaturalezaCuentas")]
    public partial class NormalizarNaturalezaCuentas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Deudora: D, Deudora, deudora... Acreedora: C, A, H (Haber),
            // Acreedora... Cualquier otro valor se deja intacto (no se adivina).
            migrationBuilder.Sql("""
                UPDATE "CuentasContables"
                SET "Naturaleza" = 'D'
                WHERE UPPER(LEFT(TRIM("Naturaleza"), 1)) = 'D'
                  AND "Naturaleza" <> 'D';

                UPDATE "CuentasContables"
                SET "Naturaleza" = 'C'
                WHERE UPPER(LEFT(TRIM("Naturaleza"), 1)) IN ('A', 'C', 'H')
                  AND "Naturaleza" <> 'C';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No reversible: no se conserva el formato original de cada cuenta.
            // "D"/"C" es un formato válido para todo el sistema, por lo que
            // dejar los datos normalizados no rompe las migraciones anteriores.
        }
    }
}
