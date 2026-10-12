using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiempresaUsuarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmpresaPredeterminadaId",
                table: "Usuarios",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UsuariosEmpresas",
                columns: table => new
                {
                    UsuarioId = table.Column<int>(type: "int", nullable: false),
                    EmpresaId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsuariosEmpresas", x => new { x.UsuarioId, x.EmpresaId });
                    table.ForeignKey(
                        name: "FK_UsuariosEmpresas_Empresa_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UsuariosEmpresas_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UsuariosEmpresas_EmpresaId",
                table: "UsuariosEmpresas",
                column: "EmpresaId");

            // ------------------------------------------------------------------
            // BACKFILL CRÍTICO (Multi-tenant): para NO dejar a ningún usuario
            // existente sin acceso, se le asignan TODAS las empresas que ya
            // existen en el momento de la migración. Después, el administrador
            // puede recortar asignaciones desde la pantalla de Usuarios.
            // Nota: el AdministradorSistema ve todas por rol (no depende de estas
            // filas), pero se poblan igual para que el selector muestre la lista.
            // ------------------------------------------------------------------
            migrationBuilder.Sql(@"
                INSERT INTO UsuariosEmpresas (UsuarioId, EmpresaId)
                SELECT u.Id, e.Id
                FROM Usuarios u
                CROSS JOIN Empresa e
                WHERE NOT EXISTS (
                    SELECT 1 FROM UsuariosEmpresas ue
                    WHERE ue.UsuarioId = u.Id AND ue.EmpresaId = e.Id);

                -- Empresa predeterminada: la de menor Id para quien no tenga.
                UPDATE u
                SET u.EmpresaPredeterminadaId = (SELECT MIN(e.Id) FROM Empresa e)
                FROM Usuarios u
                WHERE u.EmpresaPredeterminadaId IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsuariosEmpresas");

            migrationBuilder.DropColumn(
                name: "EmpresaPredeterminadaId",
                table: "Usuarios");
        }
    }
}
