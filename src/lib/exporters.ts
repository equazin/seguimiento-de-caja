import type { Movimiento, Categoria, Cuenta } from '@/db/schema'
import { formatDate, formatMoney } from './formatters'

export async function exportToExcel(
  movimientos: Movimiento[],
  categorias: Categoria[],
  cuentas: Cuenta[],
  titulo: string = 'Reporte'
) {
  const { utils, writeFile } = await import('xlsx')

  const catMap = new Map(categorias.map(c => [c.id, c.nombre]))
  const cuentaMap = new Map(cuentas.map(c => [c.id, c.nombre]))

  const rows = movimientos.map(m => ({
    Fecha: formatDate(m.fecha),
    Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
    Descripción: m.descripcion,
    Categoría: catMap.get(m.categoria_id) ?? '',
    'Monto ARS': m.monto_ars,
    'Monto USD': m.monto_usd ?? '',
    'Tipo de cambio': m.tipo_cambio ?? '',
    Contacto: m.contacto ?? '',
    'Método de pago': m.metodo_pago,
    Cuenta: cuentaMap.get(m.cuenta_id) ?? '',
    Notas: m.notas ?? '',
  }))

  const totalesFila = {
    Fecha: 'TOTALES',
    Tipo: '',
    Descripción: '',
    Categoría: '',
    'Monto ARS': movimientos.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto_ars : -m.monto_ars), 0),
    'Monto USD': '',
    'Tipo de cambio': '',
    Contacto: '',
    'Método de pago': '',
    Cuenta: '',
    Notas: '',
  }

  rows.push(totalesFila as typeof rows[0])

  const ws = utils.json_to_sheet(rows)

  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 25 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 20 }, { wch: 30 },
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Movimientos')

  writeFile(wb, `${titulo}.xlsx`)
}

export async function exportToPDF(
  movimientos: Movimiento[],
  categorias: Categoria[],
  cuentas: Cuenta[],
  titulo: string = 'Reporte',
  periodo: string = ''
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const catMap = new Map(categorias.map(c => [c.id, c.nombre]))
  const cuentaMap = new Map(cuentas.map(c => [c.id, c.nombre]))

  const doc = new jsPDF({ orientation: 'landscape' })

  // Header
  doc.setFillColor(15, 17, 23)
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Bartez Tecnología', 14, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Distribuidora mayorista de equipos IT', 14, 21)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, doc.internal.pageSize.width / 2, 14, { align: 'center' })
  if (periodo) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(periodo, doc.internal.pageSize.width / 2, 21, { align: 'center' })
  }

  // Resumen
  const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto_ars, 0)
  const egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto_ars, 0)
  const resultado = ingresos - egresos

  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10)
  doc.text(`Ingresos: ${formatMoney(ingresos)}`, 14, 38)
  doc.text(`Egresos: ${formatMoney(egresos)}`, 80, 38)
  doc.text(`Resultado neto: ${formatMoney(resultado)}`, 160, 38)

  autoTable(doc, {
    startY: 45,
    head: [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto ARS', 'Contacto', 'Método', 'Cuenta']],
    body: movimientos.map(m => [
      formatDate(m.fecha),
      m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
      m.descripcion,
      catMap.get(m.categoria_id) ?? '',
      formatMoney(m.monto_ars),
      m.contacto ?? '',
      m.metodo_pago,
      cuentaMap.get(m.cuenta_id) ?? '',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 16 },
      4: { halign: 'right', cellWidth: 28 },
    },
  })

  doc.save(`${titulo}.pdf`)
}
