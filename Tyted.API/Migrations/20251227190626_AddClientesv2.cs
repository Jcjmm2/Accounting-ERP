using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    public partial class AddClientesv2 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. ELIMINAR TODAS LAS LLAVES FORÁNEAS QUE DEPENDEN DE PRODUCTOS.CODIGOPROD
            migrationBuilder.DropForeignKey(name: "FK_ProductosUnidad_Productos_CodigoProd", table: "ProductosUnidad");
            migrationBuilder.DropForeignKey(name: "FK_InventarioMovimientos_Productos_CodigoProd", table: "InventarioMovimientos");
            migrationBuilder.DropForeignKey(name: "FK_ComprasDetalle_Productos_CodigoProd", table: "ComprasDetalle");
            migrationBuilder.DropForeignKey(name: "FK_VentasDetalle_Productos_CodigoProd", table: "VentasDetalle");

            // 2. CREAR TABLA CLIENTES
            migrationBuilder.CreateTable(
                name: "Clientes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Rif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Nombre = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Direccion = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Telefono = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PermitirCredito = table.Column<bool>(type: "bit", nullable: false),
                    LimiteCreditoUSD = table.Column<decimal>(type: "decimal(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clientes", x => x.Id);
                });

            migrationBuilder.CreateIndex(name: "IX_Clientes_Rif", table: "Clientes", column: "Rif", unique: true);

            // 3. INSERTAR CLIENTE EVENTUAL
            migrationBuilder.Sql("INSERT INTO Clientes (Rif, Nombre, PermitirCredito, LimiteCreditoUSD) VALUES ('V00000000', 'CLIENTE EVENTUAL', 0, 0)");

            // 4. AGREGAR COLUMNAS DE CLIENTEID
            migrationBuilder.AddColumn<int>(name: "ClienteId", table: "Ventas", type: "int", nullable: true);
            migrationBuilder.AddColumn<int>(name: "ClienteId", table: "Pedidos", type: "int", nullable: true);

            // 5. MIGRAR DATOS EXISTENTES
            migrationBuilder.Sql("UPDATE Ventas SET ClienteId = (SELECT TOP 1 Id FROM Clientes WHERE Rif = 'V00000000') WHERE ClienteId IS NULL");
            migrationBuilder.Sql("UPDATE Pedidos SET ClienteId = (SELECT TOP 1 Id FROM Clientes WHERE Rif = 'V00000000') WHERE ClienteId IS NULL");

            // 6. CAMBIAR TAMAÑO DE COLUMNAS (ALTER COLUMN) EN TODAS LAS TABLAS INVOLUCRADAS
            // Es vital que TODOS tengan el mismo tamaño (100) para poder volver a crear las FK
            migrationBuilder.AlterColumn<string>(name: "CodigoProd", table: "Productos", type: "nvarchar(100)", maxLength: 100, nullable: false);
            migrationBuilder.AlterColumn<string>(name: "CodigoProd", table: "ProductosUnidad", type: "nvarchar(100)", maxLength: 100, nullable: false);
            migrationBuilder.AlterColumn<string>(name: "CodigoProd", table: "InventarioMovimientos", type: "nvarchar(100)", maxLength: 100, nullable: false);
            migrationBuilder.AlterColumn<string>(name: "CodigoProd", table: "ComprasDetalle", type: "nvarchar(100)", maxLength: 100, nullable: false);
            migrationBuilder.AlterColumn<string>(name: "CodigoProd", table: "VentasDetalle", type: "nvarchar(100)", maxLength: 100, nullable: false);
            
            // Otros cambios de tamaño solicitados
            migrationBuilder.AlterColumn<string>(name: "NombreUnidad", table: "ProductosUnidad", type: "nvarchar(200)", maxLength: 200, nullable: false);
            migrationBuilder.AlterColumn<string>(name: "Descripcion", table: "Productos", type: "nvarchar(510)", maxLength: 510, nullable: false);

            // 7. RE-ESTABLECER TODAS LAS LLAVES FORÁNEAS
            migrationBuilder.AddForeignKey(name: "FK_ProductosUnidad_Productos_CodigoProd", table: "ProductosUnidad", column: "CodigoProd", principalTable: "Productos", principalColumn: "CodigoProd", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey(name: "FK_InventarioMovimientos_Productos_CodigoProd", table: "InventarioMovimientos", column: "CodigoProd", principalTable: "Productos", principalColumn: "CodigoProd", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_ComprasDetalle_Productos_CodigoProd", table: "ComprasDetalle", column: "CodigoProd", principalTable: "Productos", principalColumn: "CodigoProd", onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(name: "FK_VentasDetalle_Productos_CodigoProd", table: "VentasDetalle", column: "CodigoProd", principalTable: "Productos", principalColumn: "CodigoProd", onDelete: ReferentialAction.Cascade);

            // 8. CREAR RELACIONES DE CLIENTES
            migrationBuilder.CreateIndex(name: "IX_Ventas_ClienteId", table: "Ventas", column: "ClienteId");
            migrationBuilder.CreateIndex(name: "IX_Pedidos_ClienteId", table: "Pedidos", column: "ClienteId");
            migrationBuilder.AddForeignKey(name: "FK_Ventas_Clientes_ClienteId", table: "Ventas", column: "ClienteId", principalTable: "Clientes", principalColumn: "Id");
            migrationBuilder.AddForeignKey(name: "FK_Pedidos_Clientes_ClienteId", table: "Pedidos", column: "ClienteId", principalTable: "Clientes", principalColumn: "Id");

            // 9. LIMPIEZA
            migrationBuilder.DropColumn(name: "Cliente", table: "Ventas");
            migrationBuilder.DropColumn(name: "Cliente", table: "Pedidos");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Omitido para brevedad, pero en desarrollo puedes usar DropTable Clientes
            migrationBuilder.DropTable(name: "Clientes");
        }
    }
}
