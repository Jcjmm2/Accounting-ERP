using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AuditoriaEdicionAsientos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaUltimaModificacion",
                table: "AsientosContables",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FueModificadoManualmente",
                table: "AsientosContables",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SnapshotOriginalJson",
                table: "AsientosContables",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UsuarioModificacion",
                table: "AsientosContables",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FechaUltimaModificacion",
                table: "AsientosContables");

            migrationBuilder.DropColumn(
                name: "FueModificadoManualmente",
                table: "AsientosContables");

            migrationBuilder.DropColumn(
                name: "SnapshotOriginalJson",
                table: "AsientosContables");

            migrationBuilder.DropColumn(
                name: "UsuarioModificacion",
                table: "AsientosContables");
        }
    }
}
