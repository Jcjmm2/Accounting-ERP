import { useState, useContext } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import { guiaCuentasBase } from './libroComprasHelpers';
import {
  fechaHoy,
  periodoDefecto,
  periodoPorFecha,
  fechaAjustadaAlPeriodo,
  validarFechaPeriodo,
  avisoPeriodoDistinto,
  etiquetaPeriodo
} from './periodoDocHelper';

// ---------------------------------------------------------------------------
// HOOK DE ALTA DE COMPRA FISCAL (factura con líneas de producto): documento
// declarativo SIN inventario (sin stock, sin costos, sin kardex). Captura en
// BOLÍVARES (la verdad fiscal vive en *MonedaExt) y puede contabilizarse
// automáticamente con el motor de asientos (BE-F4). El PERIODO AL QUE AFECTA
// lo define la fecha del documento (regla «fecha ∈ periodo»): el default es
// el periodo que contiene la fecha del computador.
// ---------------------------------------------------------------------------
const formCompraInicial = (periodos = []) => {
  const periodoIni = periodoDefecto(periodos);
  return {
    fecha: fechaAjustadaAlPeriodo(periodoIni, fechaHoy()),
    periodoId: periodoIni?.id ?? '',
    codigoProv: '',
    numeroFactura: '',
    numeroControl: '',
    tipoTransaccion: '01'
  };
};

export function useAltaCompraFiscal({ empresaId, cargarCompras }) {
  const { tasa, periodos, periodoActivo } = useContext(ConfigContext);

  const [guardandoCompra, setGuardandoCompra] = useState(false);
  const [contabilizarAuto, setContabilizarAuto] = useState(true);
  const [formCompra, setFormCompra] = useState(() => formCompraInicial(periodos));
  const [lineasCompra, setLineasCompra] = useState([]);
  const [buscadorProd, setBuscadorProd] = useState('');
  const [resultadosProd, setResultadosProd] = useState([]);

  // Limpia el modo FACTURA al abrir el formulario único (periodo por defecto:
  // el que contiene la fecha del computador, o el primer periodo abierto).
  const limpiar = () => {
    setFormCompra(formCompraInicial(periodos));
    setLineasCompra([]);
    setBuscadorProd('');
    setResultadosProd([]);
  };

  // --- PERIODO AL QUE AFECTA (regla «fecha ∈ periodo») ---
  const periodoDocCompra = periodos.find((p) => Number(p.id) === Number(formCompra.periodoId)) || null;

  // Cambio de FECHA: recalcula el periodo que la contiene (mensual > anual).
  const cambiarFechaCompra = (fecha) => {
    const periodo = periodoPorFecha(periodos, fecha);
    setFormCompra((prev) => ({ ...prev, fecha, periodoId: periodo?.id ?? prev.periodoId }));
  };

  // Cambio de PERIODO: la fecha se acota a su rango del periodo elegido.
  const cambiarPeriodoCompra = (periodoId) => {
    const periodo = periodos.find((p) => Number(p.id) === Number(periodoId)) || null;
    setFormCompra((prev) => ({ ...prev, periodoId, fecha: fechaAjustadaAlPeriodo(periodo, prev.fecha) }));
  };

  // Totales del formulario en Bs. con desglose por alícuota (Providencia 0049):
  // exento, base reducida 8%, base general 16% y total con IVA.
  const totalesFormCompra = lineasCompra.reduce((acc, l) => {
    const base = Number(l.costo) * Number(l.cantidad);
    const iva = base * (Number(l.tasaIVA) / 100);
    acc.subtotal += base;
    acc.iva += iva;
    if (Number(l.tasaIVA) === 0) acc.exento += base;
    else if (Number(l.tasaIVA) === 8) { acc.base8 += base; acc.iva8 += iva; }
    else { acc.base16 += base; acc.iva16 += iva; }
    return acc;
  }, { subtotal: 0, iva: 0, exento: 0, base8: 0, iva8: 0, base16: 0, iva16: 0 });
  totalesFormCompra.total = totalesFormCompra.subtotal + totalesFormCompra.iva;

  const buscarProdFiscal = async (valor) => {
    setBuscadorProd(valor);
    if (valor.trim().length < 2) { setResultadosProd([]); return; }
    try {
      const data = await fiscalApi.buscarProductos(valor, Number(tasa) || 1);
      const unicos = [];
      const vistos = new Set();
      (Array.isArray(data) ? data : []).forEach((p) => {
        if (!vistos.has(p.codigoProd)) { vistos.add(p.codigoProd); unicos.push(p); }
      });
      setResultadosProd(unicos);
    } catch {
      setResultadosProd([]);
    }
  };

  const agregarLineaCompra = (prod) => {
    // El formulario fiscal captura en BOLÍVARES: el costo del producto se
    // precarga convertido a Bs. con la tasa del día (USD × tasa).
    const tasaDia = Number(tasa) || 1;
    const costoUsd = Number(prod.costoUSD || prod.costoUnitarioMonedaBase || prod.precioUSD || 0);
    setLineasCompra(prev => [...prev, {
      idProductoUnidad: prod.idProductoUnidad,
      codigoProd: prod.codigoProd,
      descripcion: prod.descripcion || 'PRODUCTO',
      unidad: prod.unidad || 'UND',
      costo: Number((costoUsd * tasaDia).toFixed(2)),
      cantidad: 1,
      tasaIVA: Number(prod.porcentajeIva || 0)
    }]);
    setBuscadorProd('');
    setResultadosProd([]);
  };

  const modificarLineaCompra = (idx, campo, valor) => {
    setLineasCompra(prev => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  const quitarLineaCompra = (idx) => {
    setLineasCompra(prev => prev.filter((_, i) => i !== idx));
  };

  const guardarCompraFiscal = async () => {
    if (lineasCompra.length === 0) { alert('⚠️ Agregue al menos una línea a la compra fiscal.'); return; }
    // PERIODO AL QUE AFECTA: la fecha debe caer dentro del periodo elegido y
    // el periodo debe estar ABIERTO (el backend vuelve a validar la regla
    // «fecha ∈ periodo» al crear el documento).
    const errorPeriodo = validarFechaPeriodo({ periodo: periodoDocCompra, fecha: formCompra.fecha, empresaId });
    if (errorPeriodo) { alert(`⚠️ ${errorPeriodo}`); return; }
    if (!formCompra.codigoProv) { alert('⚠️ Seleccione el proveedor (su RIF alimenta el Libro de Compras).'); return; }
    if (!formCompra.numeroFactura?.trim()) { alert('⚠️ Indique el N° de factura (dato obligatorio del Libro de Compras).'); return; }
    if (formCompra.tipoTransaccion === '01' && !formCompra.numeroControl?.trim()) {
      alert('⚠️ El N° de control es obligatorio para el tipo 01 (Registro).\n\nEs un dato obligatorio del Libro de Compras; si el documento no tiene control, escriba «S/N».');
      return;
    }

    const confirmado = window.confirm(
      'Registrar la compra fiscal (documento declarativo).\n\n' +
      `Periodo contable: ${etiquetaPeriodo(periodoDocCompra)}\n` +
      'NO afecta el inventario: sin aumento de stock, sin actualización de costos y sin kardex.' +
      (contabilizarAuto ? '\nSe generará además su comprobante contable.' : '')
    );
    if (!confirmado) return;

    setGuardandoCompra(true);
    try {
      const creada = await fiscalApi.crearCompraFiscal({
        empresaId,
        codigoProv: Number(formCompra.codigoProv),
        fechaCompra: `${formCompra.fecha}T12:00:00`,
        numeroFactura: formCompra.numeroFactura,
        numeroControl: formCompra.numeroControl || null,
        tipoTransaccion: formCompra.tipoTransaccion,
        // El formulario fiscal captura en BOLÍVARES: TipoMoneda VES le indica al
        // backend que los costos llegan en CostoUnitarioMonedaExt (Bs. exactos).
        tipoMoneda: 'VES',
        tasaDeCambio: Number(tasa) || 1,
        aplicaLibroCompras: true,
        esGastoServicio: false,
        detalles: lineasCompra.map(l => ({
          codigoProd: l.codigoProd,
          idProductoUnidad: Number(l.idProductoUnidad),
          unidadCompra: l.unidad,
          cantidad: Number(l.cantidad),
          // En modo VES la verdad fiscal vive en *MonedaExt (Bs.).
          costoUnitarioMonedaBase: 0,
          costoUnitarioMonedaExt: Number(l.costo),
          tasaIVA: Number(l.tasaIVA)
        }))
      });

      if (contabilizarAuto && creada?.id) {
        try {
          const r = await fiscalApi.contabilizarCompra(creada.id);
          if (!r.generada) alert(`⚠️ Compra registrada, pero el comprobante no se generó:\n${r.advertencia || r.mensaje || ''}${guiaCuentasBase(r.advertencia)}`);
        } catch (errorC) {
          alert(`⚠️ Compra registrada; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert('✅ Compra fiscal registrada (sin efectos en inventario).');
      await cargarCompras();
      return true;
    } catch (error) {
      console.error('Error creando compra fiscal:', error);
      alert(`❌ No se pudo registrar la compra fiscal:\n${mensajeErrorApi(error)}`);
      return false;
    } finally {
      setGuardandoCompra(false);
    }
  };

  return {
    formCompra, setFormCompra,
    lineasCompra,
    buscadorProd, resultadosProd, buscarProdFiscal,
    agregarLineaCompra, modificarLineaCompra, quitarLineaCompra,
    totalesFormCompra,
    contabilizarAuto, setContabilizarAuto,
    guardandoCompra,
    guardarCompraFiscal, limpiar,
    // Periodo al que afecta el documento (regla «fecha ∈ periodo»): periodo
    // elegido, cambio cruzado fecha ↔ periodo y aviso si difiere del activo.
    periodoDocCompra,
    cambiarFechaCompra, cambiarPeriodoCompra,
    avisoPeriodo: avisoPeriodoDistinto(periodoDocCompra, periodoActivo)
  };
}
