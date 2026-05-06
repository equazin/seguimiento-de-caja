import { supabaseAfip } from '@/db/schema'
import type {
  ArcaComprobante,
  Cliente,
  Documento,
  DocumentoItem,
  Empresa,
  Proveedor,
} from '@/db/schema'
import { formatDate, formatMoney } from '@/lib/formatters'
import { tipoDocumentoLabel } from '@/lib/documentos'

interface DocumentoDetalle {
  documento: Documento
  items: DocumentoItem[]
  empresa: Empresa
  contacto: Cliente | Proveedor | null
  arca: ArcaComprobante | null
}

export async function descargarDocumentoPdf(documentoId: string): Promise<void> {
  const detalle = await getDocumentoDetalle(documentoId)
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const { default: QRCode } = await import('qrcode')

  const { documento, empresa, contacto, arca } = detalle
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.width
  const isFiscal = documento.tipo_documento === 'factura' && !!arca?.cae
  const titulo = tituloDocumento(documento, arca)

  doc.setDrawColor(35, 42, 58)
  doc.setLineWidth(0.35)
  doc.setFillColor(248, 249, 252)
  doc.rect(12, 12, pageWidth - 24, 36, 'FD')
  doc.line(pageWidth / 2, 12, pageWidth / 2, 46)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(empresa.razon_social, 16, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`CUIT: ${empresa.cuit}`, 16, 29)
  if (empresa.domicilio_fiscal) doc.text(empresa.domicilio_fiscal, 16, 35)
  if (empresa.condicion_iva) doc.text(`IVA: ${condicionIvaLabel(empresa.condicion_iva)}`, 16, 41)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(documento.letra ?? 'X', pageWidth / 2, 24, { align: 'center' })
  doc.setFontSize(12)
  doc.text(titulo, pageWidth - 16, 23, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Fecha: ${formatDate(documento.fecha)}`, pageWidth - 16, 31, { align: 'right' })
  doc.text(`Interno: ${documento.numero_interno}`, pageWidth - 16, 37, { align: 'right' })
  if (arca) {
    doc.text(`PV ${String(arca.punto_venta).padStart(4, '0')} - Comp. ${String(arca.numero_comprobante ?? 0).padStart(8, '0')}`, pageWidth - 16, 43, { align: 'right' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(documento.tipo_operacion === 'venta' ? 'Cliente' : 'Proveedor', 14, 57)
  doc.setFont('helvetica', 'normal')
  doc.text(contacto?.razon_social ?? 'Consumidor final', 14, 64)
  const documentoContacto = contacto?.numero_documento
    ? `${contacto.tipo_documento} ${contacto.numero_documento}`
    : 'Doc. no informado'
  doc.text(documentoContacto, 14, 70)
  if (contacto?.condicion_iva) doc.text(`IVA: ${condicionIvaLabel(contacto.condicion_iva)}`, 14, 76)
  if (contacto?.domicilio) doc.text(contacto.domicilio, 14, 82)

  autoTable(doc, {
    startY: 86,
    head: [['Codigo', 'Descripcion', 'Cant.', 'P. unit.', 'IVA', 'Subtotal', 'Total']],
    body: detalle.items.map(item => [
      item.codigo ?? '',
      item.descripcion,
      String(item.cantidad),
      formatMoney(item.precio_unitario, documento.moneda),
      `${item.alicuota_iva}%`,
      formatMoney(item.subtotal, documento.moneda),
      formatMoney(item.total, documento.moneda),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [36, 39, 55], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 247, 250] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  })

  const finalY = Math.max((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100, 120)
  const totalsX = pageWidth - 75
  doc.setFontSize(9)
  doc.text('Subtotal', totalsX, finalY + 10)
  doc.text(formatMoney(documento.subtotal, documento.moneda), pageWidth - 16, finalY + 10, { align: 'right' })
  doc.text('IVA', totalsX, finalY + 16)
  doc.text(formatMoney(documento.iva_total, documento.moneda), pageWidth - 16, finalY + 16, { align: 'right' })
  if (documento.exento > 0) {
    doc.text('Exento', totalsX, finalY + 22)
    doc.text(formatMoney(documento.exento, documento.moneda), pageWidth - 16, finalY + 22, { align: 'right' })
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total', totalsX, finalY + 31)
  doc.text(formatMoney(documento.total, documento.moneda), pageWidth - 16, finalY + 31, { align: 'right' })

  if (isFiscal && arca) {
    const qrUrl = buildArcaQrUrl({ documento, empresa, contacto, arca })
    const qr = await QRCode.toDataURL(qrUrl, { margin: 2, width: 220 })
    doc.addImage(qr, 'PNG', 14, finalY + 10, 38, 38)
    doc.setDrawColor(35, 42, 58)
    doc.rect(14, finalY + 10, 38, 38)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Comprobante autorizado por ARCA', 57, finalY + 19)
    doc.text(`CAE: ${arca.cae}`, 57, finalY + 27)
    doc.text(`Vencimiento CAE: ${arca.cae_vencimiento ? formatDate(arca.cae_vencimiento) : '-'}`, 57, finalY + 35)
    doc.text('QR de validación fiscal', 57, finalY + 43)
  }

  if (documento.observaciones) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Obs.: ${documento.observaciones}`, 14, 282, { maxWidth: pageWidth - 28 })
  }

  doc.save(`${documento.numero_interno}.pdf`)
}

async function getDocumentoDetalle(documentoId: string): Promise<DocumentoDetalle> {
  const { data: documento, error: docError } = await supabaseAfip
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .single()
  if (docError) throw docError

  const doc = documento as Documento
  const [items, empresa, arca, contacto] = await Promise.all([
    getItems(doc.id),
    getEmpresa(doc.empresa_id),
    getArca(doc.id),
    getContacto(doc),
  ])

  return { documento: doc, items, empresa, arca, contacto }
}

async function getItems(documentoId: string): Promise<DocumentoItem[]> {
  const { data, error } = await supabaseAfip
    .from('documento_items')
    .select('*')
    .eq('documento_id', documentoId)
    .order('orden', { ascending: true })
  if (error) throw error
  return (data ?? []) as DocumentoItem[]
}

async function getEmpresa(empresaId: string): Promise<Empresa> {
  const { data, error } = await supabaseAfip
    .from('empresas')
    .select('*')
    .eq('id', empresaId)
    .single()
  if (error) throw error
  return data as Empresa
}

async function getArca(documentoId: string): Promise<ArcaComprobante | null> {
  const { data, error } = await supabaseAfip
    .from('arca_comprobantes')
    .select('*')
    .eq('documento_id', documentoId)
    .maybeSingle()
  if (error) throw error
  return data as ArcaComprobante | null
}

async function getContacto(doc: Documento): Promise<Cliente | Proveedor | null> {
  if (doc.tipo_operacion === 'venta' && doc.cliente_id) {
    const { data, error } = await supabaseAfip.from('clientes').select('*').eq('id', doc.cliente_id).single()
    if (error) throw error
    return data as Cliente
  }
  if (doc.tipo_operacion === 'compra' && doc.proveedor_id) {
    const { data, error } = await supabaseAfip.from('proveedores').select('*').eq('id', doc.proveedor_id).single()
    if (error) throw error
    return data as Proveedor
  }
  return null
}

function tituloDocumento(documento: Documento, arca: ArcaComprobante | null): string {
  const base = tipoDocumentoLabel(documento.tipo_documento)
  if (!arca) return base
  return `${base} ${documento.letra ?? ''}`.trim()
}

function condicionIvaLabel(value: string): string {
  const labels: Record<string, string> = {
    responsable_inscripto: 'Responsable inscripto',
    monotributo: 'Monotributo',
    consumidor_final: 'Consumidor final',
    exento: 'Exento',
    no_categorizado: 'No categorizado',
  }
  return labels[value] ?? value
}

function buildArcaQrUrl(input: {
  documento: Documento
  empresa: Empresa
  contacto: Cliente | Proveedor | null
  arca: ArcaComprobante
}): string {
  const { documento, empresa, contacto, arca } = input
  const payload = {
    ver: 1,
    fecha: documento.fecha,
    cuit: Number(onlyDigits(empresa.cuit)),
    ptoVta: arca.punto_venta,
    tipoCmp: arca.tipo_comprobante,
    nroCmp: arca.numero_comprobante,
    importe: Number(documento.total),
    moneda: documento.moneda === 'USD' ? 'DOL' : 'PES',
    ctz: Number(documento.tipo_cambio),
    tipoDocRec: contacto?.numero_documento ? tipoDocumentoReceptor(contacto.tipo_documento) : 99,
    nroDocRec: contacto?.numero_documento ? Number(onlyDigits(contacto.numero_documento)) : 0,
    tipoCodAut: 'E',
    codAut: Number(arca.cae),
  }
  const json = JSON.stringify(payload)
  const encoded = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `https://www.arca.gob.ar/fe/qr/?p=${encoded}`
}

function tipoDocumentoReceptor(tipo: string): number {
  const table: Record<string, number> = {
    CUIT: 80,
    CUIL: 86,
    DNI: 96,
    CDI: 87,
    LE: 89,
    LC: 90,
    PASAPORTE: 94,
    OTRO: 99,
  }
  return table[tipo] ?? 99
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}
