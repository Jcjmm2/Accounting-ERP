using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tyted.API.Migrations
{
    /// <inheritdoc />
    public partial class FixPeriodoContableSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.PeriodosContables', 'Mes') IS NOT NULL
                BEGIN
                    DECLARE @constraintName nvarchar(200);
                    SELECT @constraintName = dc.name
                    FROM sys.default_constraints dc
                    INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                    WHERE dc.parent_object_id = OBJECT_ID('dbo.PeriodosContables') AND c.name = 'Mes';

                    IF @constraintName IS NOT NULL
                    BEGIN
                        DECLARE @sql nvarchar(max) = N'ALTER TABLE [dbo].[PeriodosContables] DROP CONSTRAINT ' + QUOTENAME(@constraintName);
                        EXEC sp_executesql @sql;
                    END;

                    ALTER TABLE [dbo].[PeriodosContables] ALTER COLUMN [Mes] int NULL;
                END;
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.PeriodosContables', 'Estado') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[PeriodosContables] ADD [Estado] nvarchar(20) NOT NULL DEFAULT N'Abierto';
                END;
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.PeriodosContables', 'FechaCierre') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[PeriodosContables] ADD [FechaCierre] datetime2 NULL;
                END;
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.PeriodosContables', 'Nombre') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[PeriodosContables] ADD [Nombre] nvarchar(100) NULL;
                END;
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.PeriodosContables', 'PeriodoPadreId') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[PeriodosContables] ADD [PeriodoPadreId] int NULL;
                END;
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.PeriodosContables', 'TipoPeriodo') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[PeriodosContables] ADD [TipoPeriodo] nvarchar(20) NOT NULL DEFAULT N'Mensual';
                END;
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.PeriodosContables', 'UsuarioCierre') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[PeriodosContables] ADD [UsuarioCierre] nvarchar(100) NULL;
                END;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = 'IX_PeriodosContables_EmpresaId_Anio_Mes'
                      AND object_id = OBJECT_ID('dbo.PeriodosContables'))
                BEGIN
                    CREATE UNIQUE INDEX [IX_PeriodosContables_EmpresaId_Anio_Mes]
                    ON [dbo].[PeriodosContables] ([EmpresaId], [Anio], [Mes])
                    WHERE [Mes] IS NOT NULL;
                END;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = 'IX_PeriodosContables_PeriodoPadreId'
                      AND object_id = OBJECT_ID('dbo.PeriodosContables'))
                BEGIN
                    CREATE INDEX [IX_PeriodosContables_PeriodoPadreId]
                    ON [dbo].[PeriodosContables] ([PeriodoPadreId]);
                END;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.foreign_keys
                    WHERE name = 'FK_PeriodosContables_PeriodosContables_PeriodoPadreId')
                BEGIN
                    ALTER TABLE [dbo].[PeriodosContables]
                    ADD CONSTRAINT [FK_PeriodosContables_PeriodosContables_PeriodoPadreId]
                    FOREIGN KEY ([PeriodoPadreId]) REFERENCES [dbo].[PeriodosContables] ([Id]);
                END;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PeriodosContables_PeriodosContables_PeriodoPadreId",
                table: "PeriodosContables");

            migrationBuilder.DropIndex(
                name: "IX_PeriodosContables_EmpresaId_Anio_Mes",
                table: "PeriodosContables");

            migrationBuilder.DropIndex(
                name: "IX_PeriodosContables_PeriodoPadreId",
                table: "PeriodosContables");

            migrationBuilder.DropColumn(
                name: "Estado",
                table: "PeriodosContables");

            migrationBuilder.DropColumn(
                name: "FechaCierre",
                table: "PeriodosContables");

            migrationBuilder.DropColumn(
                name: "Nombre",
                table: "PeriodosContables");

            migrationBuilder.DropColumn(
                name: "PeriodoPadreId",
                table: "PeriodosContables");

            migrationBuilder.DropColumn(
                name: "TipoPeriodo",
                table: "PeriodosContables");

            migrationBuilder.DropColumn(
                name: "UsuarioCierre",
                table: "PeriodosContables");

            migrationBuilder.AlterColumn<int>(
                name: "Mes",
                table: "PeriodosContables",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PeriodosContables_EmpresaId_Anio_Mes",
                table: "PeriodosContables",
                columns: new[] { "EmpresaId", "Anio", "Mes" },
                unique: true);
        }
    }
}
