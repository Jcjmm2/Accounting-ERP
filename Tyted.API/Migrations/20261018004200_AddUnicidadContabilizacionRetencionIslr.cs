using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUnicidadContabilizacionRetencionIslr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RetencionesIslrEmitidas_CompraId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropIndex(
                name: "IX_RetencionesIslrEmitidas_GastoId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.AddColumn<int>(
                name: "AsientoContableId",
                table: "RetencionesIslrEmitidas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AsientoReversoId",
                table: "RetencionesIslrEmitidas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaAnulacion",
                table: "RetencionesIslrEmitidas",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotivoAnulacion",
                table: "RetencionesIslrEmitidas",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_CompraId",
                table: "RetencionesIslrEmitidas",
                column: "CompraId",
                unique: true,
                filter: "[CompraId] IS NOT NULL AND [Estado] = 'Emitida'");

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_GastoId",
                table: "RetencionesIslrEmitidas",
                column: "GastoId",
                unique: true,
                filter: "[GastoId] IS NOT NULL AND [Estado] = 'Emitida'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RetencionesIslrEmitidas_CompraId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropIndex(
                name: "IX_RetencionesIslrEmitidas_GastoId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "AsientoContableId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "AsientoReversoId",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "FechaAnulacion",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.DropColumn(
                name: "MotivoAnulacion",
                table: "RetencionesIslrEmitidas");

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_CompraId",
                table: "RetencionesIslrEmitidas",
                column: "CompraId");

            migrationBuilder.CreateIndex(
                name: "IX_RetencionesIslrEmitidas_GastoId",
                table: "RetencionesIslrEmitidas",
                column: "GastoId");
        }
    }
}
