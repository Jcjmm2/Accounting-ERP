using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Tyted.API.Data;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <summary>
    /// Migración de datos: los asientos de CIERRE DE RESULTADOS existentes
    /// trasladaban el resultado a otra cuenta de patrimonio. Se reapunta su
    /// línea de patrimonio a la cuenta 3.1.3.1.02 (Resultados del ejercicio)
    /// de la MISMA empresa del asiento. No modifica el esquema.
    /// </summary>
    [DbContext(typeof(TytedContext))]
    [Migration("20261031190000_ActualizarCuentaResultadoEjercicio")]
    public partial class ActualizarCuentaResultadoEjercicio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Sólo se tocan las líneas cuya cuenta actual es de Patrimonio/Capital
            // (la línea de resultado); las líneas de ingresos/gastos no cambian.
            // Si una empresa no tiene la cuenta 3.1.3.1.02 sus asientos quedan igual.
            migrationBuilder.Sql("""
                UPDATE "AsientosDetalles" AS d
                SET "CuentaContableId" = destino."Id"
                FROM "AsientosContables" AS a,
                     "CuentasContables" AS actual,
                     "CuentasContables" AS destino
                WHERE d."AsientoContableId" = a."Id"
                  AND a."TipoComprobante" = 'Cierre'
                  AND a."Concepto" LIKE 'CIERRE DE RESULTADOS%'
                  AND actual."Id" = d."CuentaContableId"
                  AND (UPPER(actual."TipoCuenta") LIKE '%PATRIMONIO%'
                       OR UPPER(actual."TipoCuenta") LIKE '%CAPITAL%')
                  AND destino."EmpresaId" = a."EmpresaId"
                  AND destino."CodigoCuenta" = '3.1.3.1.02'
                  AND destino."Id" <> actual."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No reversible: no se conserva la cuenta de patrimonio original de
            // cada asiento. Se deja vacío para no bloquear la reversión de las
            // migraciones anteriores; los cierres pueden regenerarse desde la UI.
        }
    }
}
