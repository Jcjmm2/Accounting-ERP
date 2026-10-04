using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountingSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CuentasContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    CodigoCuenta = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    NombreCuenta = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    TipoCuenta = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Naturaleza = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    EsMovimiento = table.Column<bool>(type: "bit", nullable: false),
                    Nivel = table.Column<int>(type: "int", nullable: false),
                    PadreCuentaId = table.Column<int>(type: "int", nullable: true),
                    AceptaTerceros = table.Column<bool>(type: "bit", nullable: false),
                    AceptaCentroCosto = table.Column<bool>(type: "bit", nullable: false),
                    Activa = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CuentasContables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CuentasContables_CuentasContables_PadreCuentaId",
                        column: x => x.PadreCuentaId,
                        principalTable: "CuentasContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PeriodosContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    Anio = table.Column<int>(type: "int", nullable: false),
                    Mes = table.Column<int>(type: "int", nullable: false),
                    FechaInicio = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaFin = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Cerrado = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PeriodosContables", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AsientosContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmpresaId = table.Column<int>(type: "int", nullable: false),
                    PeriodoContableId = table.Column<int>(type: "int", nullable: false),
                    NumeroComprobante = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FechaComprobante = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Concepto = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    TipoComprobante = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: false),
                    FechaCreacion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalDebe = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalHaber = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AsientosContables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AsientosContables_PeriodosContables_PeriodoContableId",
                        column: x => x.PeriodoContableId,
                        principalTable: "PeriodosContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AsientosDetalles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AsientoContableId = table.Column<int>(type: "int", nullable: false),
                    CuentaContableId = table.Column<int>(type: "int", nullable: false),
                    Referencia = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Debe = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Haber = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AsientosDetalles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AsientosDetalles_AsientosContables_AsientoContableId",
                        column: x => x.AsientoContableId,
                        principalTable: "AsientosContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AsientosDetalles_CuentasContables_CuentaContableId",
                        column: x => x.CuentaContableId,
                        principalTable: "CuentasContables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditoriasContables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Usuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Accion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Detalle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AsientoContableId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditoriasContables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditoriasContables_AsientosContables_AsientoContableId",
                        column: x => x.AsientoContableId,
                        principalTable: "AsientosContables",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AsientosContables_PeriodoContableId",
                table: "AsientosContables",
                column: "PeriodoContableId");

            migrationBuilder.CreateIndex(
                name: "IX_AsientosDetalles_AsientoContableId",
                table: "AsientosDetalles",
                column: "AsientoContableId");

            migrationBuilder.CreateIndex(
                name: "IX_AsientosDetalles_CuentaContableId",
                table: "AsientosDetalles",
                column: "CuentaContableId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditoriasContables_AsientoContableId",
                table: "AuditoriasContables",
                column: "AsientoContableId");

            migrationBuilder.CreateIndex(
                name: "IX_CuentasContables_EmpresaId_CodigoCuenta",
                table: "CuentasContables",
                columns: new[] { "EmpresaId", "CodigoCuenta" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CuentasContables_PadreCuentaId",
                table: "CuentasContables",
                column: "PadreCuentaId");

            migrationBuilder.CreateIndex(
                name: "IX_PeriodosContables_EmpresaId_Anio_Mes",
                table: "PeriodosContables",
                columns: new[] { "EmpresaId", "Anio", "Mes" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AsientosDetalles");

            migrationBuilder.DropTable(
                name: "AuditoriasContables");

            migrationBuilder.DropTable(
                name: "CuentasContables");

            migrationBuilder.DropTable(
                name: "AsientosContables");

            migrationBuilder.DropTable(
                name: "PeriodosContables");
        }
    }
}
