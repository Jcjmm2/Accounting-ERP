-- Seed de Categorías para Tyted
-- Inserta las categorías que no estén presentes actualmente.
-- Usa ID explícitos para mantener compatibilidad con migraciones existentes.

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Activar IDENTITY_INSERT para permitir insertar IdCategoria explícitos
SET IDENTITY_INSERT Categorias ON;

-- Nota: cada INSERT se protege con IF NOT EXISTS para evitar duplicados

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 1 OR Nombre = 'Viveres Basicos')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (1, 'Viveres Basicos', 15.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 2 OR Nombre = 'Articulos de Higiene')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (2, 'Articulos de Higiene', 30.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 3 OR Nombre = 'Snacks y Golosinas')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (3, 'Snacks y Golosinas', 35.00);
END

-- Categorías adicionales propuestas (IDs nuevos a partir de 4)
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 4 OR Nombre = 'Enlatados y Untables')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (4, 'Enlatados y Untables', 20.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 5 OR Nombre = 'Cafe e Infusiones')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (5, 'Cafe e Infusiones', 18.50);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 6 OR Nombre = 'Bebidas No Alcoholicas')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (6, 'Bebidas No Alcoholicas', 23.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 7 OR Nombre = 'Snacks y Golosinas')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (7, 'Snacks y Golosinas', 27.50);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 8 OR Nombre = 'Refrigerados y Charcuteria')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (8, 'Refrigerados y Charcuteria', 24.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 9 OR Nombre = 'Higiene Personal')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (9, 'Higiene Personal', 30.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 10 OR Nombre = 'Limpieza del Hogar y Lavanderia')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (10, 'Limpieza del Hogar y Lavanderia', 25.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 11 OR Nombre = 'Productos Infantiles/Bebe')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (11, 'Productos Infantiles/Bebe', 25.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 12 OR Nombre = 'Tabaco y Fosforos')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (12, 'Tabaco y Fosforos', 30.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 13 OR Nombre = 'Miscelaneos y Desechables')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (13, 'Miscelaneos y Desechables', 32.50);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 14 OR Nombre = 'Especialidades y Sobres')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (14, 'Especialidades y Sobres', 45.00);
END

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE IdCategoria = 15 OR Nombre = 'Bebidas Alcoholicas')
BEGIN
    INSERT INTO Categorias (IdCategoria, Nombre, PorcentajeMargen)
    VALUES (15, 'Bebidas Alcoholicas', 40.00);
END

-- Desactivar IDENTITY_INSERT
SET IDENTITY_INSERT Categorias OFF;

COMMIT TRANSACTION;

-- Fin del seed
-- Recomendación: Ejecutar en entorno de desarrollo o staging y revisar duplicados antes de aplicar en producción.
