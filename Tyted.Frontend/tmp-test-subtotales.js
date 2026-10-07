const insertarSubtotalesJerarquia = (filas) => {
  const salida = [];
  const recorrer = (desde, nivel) => {
    let i = desde;
    while (i < filas.length && filas[i].profundidad >= nivel) {
      const fila = filas[i];
      salida.push(fila.cod);
      i += 1;
      if (fila.esPadre) {
        i = recorrer(i, fila.profundidad + 1);
        if (fila.profundidad > 0) salida.push('SUBTOTAL ' + fila.cod);
      }
    }
    return i;
  };
  recorrer(0, 0);
  return salida;
};
const filas = [
  { cod: '1 ACTIVO', profundidad: 0, esPadre: true },
  { cod: '1.1 CORRIENTE', profundidad: 1, esPadre: true },
  { cod: '1.1.1 CAJA', profundidad: 2, esPadre: true },
  { cod: '1.1.1.1 Cajas', profundidad: 3, esPadre: true },
  { cod: '1.1.1.1.01 Caja General', profundidad: 4, esPadre: false },
  { cod: '1.1.2 BANCOS', profundidad: 2, esPadre: true },
  { cod: '1.1.2.1 Nac', profundidad: 3, esPadre: true },
  { cod: '1.1.2.1.01 Mercantil', profundidad: 4, esPadre: false },
  { cod: '1.2 NO CORRIENTE', profundidad: 1, esPadre: false },
];
console.log(insertarSubtotalesJerarquia(filas).join('\n'));
