using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPagoRetencionIva : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AsientoContableId",
                table: "RetencionesIvaEmitidas",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AsientoPagoId",
                table: "Compras",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaPago",
                table: "Compras",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AsientoContableId",
                table: "RetencionesIvaEmitidas");

            migrationBuilder.DropColumn(
                name: "AsientoPagoId",
                table: "Compras");

            migrationBuilder.DropColumn(
                name: "FechaPago",
                table: "Compras");
        }
    }
}
