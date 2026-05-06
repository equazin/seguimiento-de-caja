import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
// @deno-types="npm:@types/node-forge@1.3.14"
import forge from 'npm:node-forge@1.3.1'

type Ambiente = 'homologacion' | 'produccion'
type Action = 'dummy' | 'login' | 'ultimo' | 'emitir'

interface Empresa {
  id: string
  cuit: string
  condicion_iva: string
  arca_ambiente: Ambiente
}

interface PuntoVenta {
  id: string
  empresa_id: string
  numero: number
  tipo_emision: string
  activo: boolean
}

interface Cliente {
  id: string
  tipo_documento: string
  numero_documento: string | null
  condicion_iva: string
}

interface Documento {
  id: string
  empresa_id: string
  tipo_operacion: string
  tipo_documento: string
  letra: string | null
  estado: string
  punto_venta_id: string | null
  cliente_id: string | null
  fecha: string
  moneda: 'ARS' | 'USD'
  tipo_cambio: number
  subtotal: number
  iva_total: number
  exento: number
  no_gravado: number
  percepciones: number
  total: number
}

interface DocumentoItem {
  alicuota_iva: number
  subtotal: number
  iva_importe: number
}

interface WsaaTicket {
  token: string
  sign: string
  generationTime: string | null
  expirationTime: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const URLS: Record<Ambiente, { wsaa: string; wsfe: string }> = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
}

const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/'
const WSFE_NS = 'http://ar.gov.afip.dif.FEV1/'

serve(async req => {
  if (req.method === 'OPTIONS') return json(null, 204)
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '') as Action
    if (!['dummy', 'login', 'ultimo', 'emitir'].includes(action)) {
      return json({ error: 'Action invalida' }, 400)
    }

    const context = await createContext(req)

    if (action === 'dummy') {
      await requireAuth(context)
      const ambiente = parseAmbiente(body.ambiente)
      assertHomologacion(ambiente)
      const result = await wsfeDummy(ambiente)
      return json({ ok: true, ambiente, result })
    }

    if (action === 'emitir') {
      await requireAuth(context)
      const result = await emitirDocumento(context, String(body.documentoId ?? ''), body.puntoVentaId)
      return json({ ok: true, ...result })
    }

    const empresaId = String(body.empresaId ?? '')
    if (!empresaId) return json({ error: 'empresaId es requerido' }, 400)
    await requireEmpresaAccess(context, empresaId)
    const empresa = await getEmpresa(context.serviceClient, empresaId)
    assertHomologacion(empresa.arca_ambiente)

    if (action === 'login') {
      const ticket = await getWsaaTicket(context.serviceClient, empresa, false)
      return json({
        ok: true,
        ambiente: empresa.arca_ambiente,
        generationTime: ticket.generationTime,
        expirationTime: ticket.expirationTime,
      })
    }

    const puntoVenta = Number(body.puntoVenta)
    const tipoComprobante = Number(body.tipoComprobante)
    if (!Number.isInteger(puntoVenta) || puntoVenta < 1) {
      return json({ error: 'puntoVenta invalido' }, 400)
    }
    if (!Number.isInteger(tipoComprobante) || tipoComprobante < 1) {
      return json({ error: 'tipoComprobante invalido' }, 400)
    }
    const ultimo = await feCompUltimoAutorizado(context.serviceClient, empresa, puntoVenta, tipoComprobante)
    return json({ ok: true, ambiente: empresa.arca_ambiente, puntoVenta, tipoComprobante, ultimo })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    const status = message === 'No autorizado' ? 401 : 500
    return json({ error: message }, status)
  }
})

async function createContext(req: Request) {
  const supabaseUrl = getEnv('SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY')
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization') ?? ''

  return {
    authorization,
    authClient: createClient(supabaseUrl, anonKey, {
      global: { headers: authorization ? { Authorization: authorization } : {} },
    }),
    serviceClient: createClient(supabaseUrl, serviceKey),
    userId: null as string | null,
  }
}

async function requireAuth(context: Awaited<ReturnType<typeof createContext>>) {
  if (!context.authorization) throw new Error('No autorizado')
  if (context.userId) return context.userId

  const { data, error } = await context.authClient.auth.getUser()
  if (error || !data.user) throw new Error('No autorizado')
  context.userId = data.user.id
  return context.userId
}

async function requireEmpresaAccess(
  context: Awaited<ReturnType<typeof createContext>>,
  empresaId: string
) {
  const userId = await requireAuth(context)
  const { data, error } = await context.serviceClient
    .from('empresa_usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No autorizado')
}

async function emitirDocumento(
  context: Awaited<ReturnType<typeof createContext>>,
  documentoId: string,
  puntoVentaIdInput: unknown
) {
  if (!documentoId) throw new Error('documentoId es requerido')

  const { data: documento, error: docError } = await context.serviceClient
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .single()
  if (docError) throw docError
  const doc = documento as Documento

  await requireEmpresaAccess(context, doc.empresa_id)
  const empresa = await getEmpresa(context.serviceClient, doc.empresa_id)
  assertHomologacion(empresa.arca_ambiente)

  if (doc.tipo_operacion !== 'venta' || doc.tipo_documento !== 'factura') {
    throw new Error('Solo se emiten facturas de venta en Fase 4')
  }
  if (doc.estado !== 'confirmado') {
    throw new Error('El documento debe estar confirmado antes de emitir')
  }

  const { data: existente, error: existenteError } = await context.serviceClient
    .from('arca_comprobantes')
    .select('cae, resultado, numero_comprobante')
    .eq('documento_id', doc.id)
    .maybeSingle()
  if (existenteError) throw existenteError
  if (existente?.cae) {
    throw new Error(`El documento ya tiene CAE (${existente.numero_comprobante})`)
  }

  const [cliente, items, puntoVenta] = await Promise.all([
    getCliente(context.serviceClient, doc.cliente_id),
    getDocumentoItems(context.serviceClient, doc.id),
    getPuntoVenta(context.serviceClient, doc, puntoVentaIdInput),
  ])

  const letra = letraParaFactura(empresa, cliente)
  if (letra === 'C' && Number(doc.iva_total) > 0) {
    throw new Error('Factura C no admite IVA discriminado; ajuste los items a IVA 0 antes de emitir')
  }
  const tipoComprobante = tipoComprobanteFiscal(doc.tipo_documento, letra)
  const ultimo = await feCompUltimoAutorizado(
    context.serviceClient,
    empresa,
    puntoVenta.numero,
    tipoComprobante
  )
  const numeroComprobante = ultimo + 1
  const request = buildFeCaeRequest({
    empresa,
    documento: doc,
    cliente,
    items,
    puntoVenta: puntoVenta.numero,
    tipoComprobante,
    numeroComprobante,
  })

  const response = await feCaeSolicitar(context.serviceClient, empresa, request.xml)
  await context.serviceClient
    .from('arca_comprobantes')
    .upsert(
      {
        documento_id: doc.id,
        empresa_id: empresa.id,
        ambiente: empresa.arca_ambiente,
        punto_venta: puntoVenta.numero,
        tipo_comprobante: tipoComprobante,
        numero_comprobante: numeroComprobante,
        cae: response.cae,
        cae_vencimiento: response.caeVencimiento,
        resultado: response.resultado,
        request_resumen: request.resumen,
        response_resumen: response.resumen,
        errores: response.errores.length ? response.errores : null,
        observaciones: response.observaciones.length ? response.observaciones : null,
        enviado_at: new Date().toISOString(),
      },
      { onConflict: 'documento_id' }
    )
    .throwOnError()

  if (response.resultado === 'A' && response.cae) {
    await context.serviceClient
      .from('documentos')
      .update({
        estado: 'emitido',
        letra,
        punto_venta_id: puntoVenta.id,
      })
      .eq('id', doc.id)
      .throwOnError()
  }

  return {
    ambiente: empresa.arca_ambiente,
    documentoId: doc.id,
    puntoVenta: puntoVenta.numero,
    tipoComprobante,
    numeroComprobante,
    resultado: response.resultado,
    cae: response.cae,
    caeVencimiento: response.caeVencimiento,
    errores: response.errores,
    observaciones: response.observaciones,
  }
}

async function getEmpresa(client: ReturnType<typeof createClient>, empresaId: string): Promise<Empresa> {
  const { data, error } = await client.from('empresas').select('*').eq('id', empresaId).single()
  if (error) throw error
  return data as Empresa
}

async function getCliente(client: ReturnType<typeof createClient>, clienteId: string | null): Promise<Cliente | null> {
  if (!clienteId) return null
  const { data, error } = await client.from('clientes').select('*').eq('id', clienteId).single()
  if (error) throw error
  return data as Cliente
}

async function getDocumentoItems(client: ReturnType<typeof createClient>, documentoId: string): Promise<DocumentoItem[]> {
  const { data, error } = await client
    .from('documento_items')
    .select('*')
    .eq('documento_id', documentoId)
    .order('orden', { ascending: true })
  if (error) throw error
  return (data ?? []) as DocumentoItem[]
}

async function getPuntoVenta(
  client: ReturnType<typeof createClient>,
  doc: Documento,
  puntoVentaIdInput: unknown
): Promise<PuntoVenta> {
  const puntoVentaId = typeof puntoVentaIdInput === 'string' && puntoVentaIdInput
    ? puntoVentaIdInput
    : doc.punto_venta_id

  let query = client
    .from('puntos_venta')
    .select('*')
    .eq('empresa_id', doc.empresa_id)
    .eq('tipo_emision', 'electronica')
    .eq('activo', true)

  if (puntoVentaId) query = query.eq('id', puntoVentaId)
  else query = query.order('numero', { ascending: true }).limit(1)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No hay punto de venta electronico activo')
  return data as PuntoVenta
}

async function getWsaaTicket(
  client: ReturnType<typeof createClient>,
  empresa: Empresa,
  forceRefresh: boolean
): Promise<WsaaTicket> {
  if (!forceRefresh) {
    const minValidUntil = new Date(Date.now() + 5 * 60_000).toISOString()
    const { data, error } = await client
      .from('arca_wsaa_tokens')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('ambiente', empresa.arca_ambiente)
      .eq('service', 'wsfe')
      .gt('expiration_time', minValidUntil)
      .maybeSingle()
    if (error) throw error
    if (data) {
      return {
        token: data.token,
        sign: data.sign,
        generationTime: data.generation_time,
        expirationTime: data.expiration_time,
      }
    }
  }

  const ticket = await wsaaLogin(empresa.arca_ambiente)
  await client
    .from('arca_wsaa_tokens')
    .upsert(
      {
        empresa_id: empresa.id,
        ambiente: empresa.arca_ambiente,
        service: 'wsfe',
        token: ticket.token,
        sign: ticket.sign,
        generation_time: ticket.generationTime,
        expiration_time: ticket.expirationTime,
      },
      { onConflict: 'empresa_id,ambiente,service' }
    )
    .throwOnError()
  return ticket
}

async function wsaaLogin(ambiente: Ambiente): Promise<WsaaTicket> {
  const cms = signLoginTicketRequest(ambiente)
  const envelope = soapEnvelope(`
    <wsaa:loginCms xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  `)
  const xml = await postSoap(URLS[ambiente].wsaa, '', envelope)
  const loginCmsReturn = getFirstText(parseXml(xml), 'loginCmsReturn')
  if (!loginCmsReturn) throw new Error('WSAA no devolvio loginCmsReturn')

  const ticketXml = decodeXml(loginCmsReturn)
  const ticketDoc = parseXml(ticketXml)
  const token = getFirstText(ticketDoc, 'token')
  const sign = getFirstText(ticketDoc, 'sign')
  const generationTime = getFirstText(ticketDoc, 'generationTime')
  const expirationTime = getFirstText(ticketDoc, 'expirationTime')
  if (!token || !sign || !expirationTime) throw new Error('WSAA devolvio un ticket incompleto')
  return { token, sign, generationTime, expirationTime }
}

async function wsfeDummy(ambiente: Ambiente) {
  const xml = await postWsfe(ambiente, 'FEDummy', soapEnvelope('<ar:FEDummy xmlns:ar="http://ar.gov.afip.dif.FEV1/"/>'))
  const doc = parseXml(xml)
  return {
    appServer: getFirstText(doc, 'AppServer'),
    dbServer: getFirstText(doc, 'DbServer'),
    authServer: getFirstText(doc, 'AuthServer'),
  }
}

async function feCompUltimoAutorizado(
  client: ReturnType<typeof createClient>,
  empresa: Empresa,
  puntoVenta: number,
  tipoComprobante: number
): Promise<number> {
  const ticket = await getWsaaTicket(client, empresa, false)
  const xml = await postWsfe(
    empresa.arca_ambiente,
    'FECompUltimoAutorizado',
    soapEnvelope(`
      <ar:FECompUltimoAutorizado xmlns:ar="${WSFE_NS}">
        ${authXml(ticket, empresa)}
        <ar:PtoVta>${puntoVenta}</ar:PtoVta>
        <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
      </ar:FECompUltimoAutorizado>
    `)
  )
  const doc = parseXml(xml)
  const errors = collectCodeMsg(doc, 'Err')
  if (errors.length) throw new Error(`WSFE FECompUltimoAutorizado rechazo: ${formatCodeMsgs(errors)}`)
  return Number(getFirstText(doc, 'CbteNro') ?? 0)
}

async function feCaeSolicitar(client: ReturnType<typeof createClient>, empresa: Empresa, feCaeReqXml: string) {
  const ticket = await getWsaaTicket(client, empresa, false)
  const xml = await postWsfe(
    empresa.arca_ambiente,
    'FECAESolicitar',
    soapEnvelope(`
      <ar:FECAESolicitar xmlns:ar="${WSFE_NS}">
        ${authXml(ticket, empresa)}
        ${feCaeReqXml}
      </ar:FECAESolicitar>
    `)
  )
  const doc = parseXml(xml)
  return {
    resultado: getFirstText(doc, 'Resultado'),
    cae: getFirstText(doc, 'CAE'),
    caeVencimiento: yyyymmddToDate(getFirstText(doc, 'CAEFchVto')),
    errores: collectCodeMsg(doc, 'Err'),
    observaciones: collectCodeMsg(doc, 'Obs'),
    resumen: {
      resultado: getFirstText(doc, 'Resultado'),
      cae: getFirstText(doc, 'CAE'),
      caeVencimiento: yyyymmddToDate(getFirstText(doc, 'CAEFchVto')),
      cbteDesde: Number(getFirstText(doc, 'CbteDesde') ?? 0),
      cbteHasta: Number(getFirstText(doc, 'CbteHasta') ?? 0),
    },
  }
}

function buildFeCaeRequest(input: {
  empresa: Empresa
  documento: Documento
  cliente: Cliente | null
  items: DocumentoItem[]
  puntoVenta: number
  tipoComprobante: number
  numeroComprobante: number
}) {
  const { documento, cliente, items, puntoVenta, tipoComprobante, numeroComprobante } = input
  const iva = ivaAlicuotasXml(items)
  const receptor = receptorFiscal(cliente)
  const moneda = documento.moneda === 'USD' ? 'DOL' : 'PES'
  const monCotiz = documento.moneda === 'USD' ? money(documento.tipo_cambio) : '1'
  const condicionIva = condicionIvaReceptorId(cliente?.condicion_iva ?? 'consumidor_final')
  const impNeto = Math.max(
    0,
    Number(documento.subtotal) - Number(documento.exento) - Number(documento.no_gravado)
  )

  const resumen = {
    puntoVenta,
    tipoComprobante,
    numeroComprobante,
    docTipo: receptor.docTipo,
    docNro: receptor.docNro,
    cbteFch: dateToYyyymmdd(documento.fecha),
    impTotal: Number(money(documento.total)),
    impNeto: Number(money(impNeto)),
    impIVA: Number(money(documento.iva_total)),
    impOpEx: Number(money(documento.exento)),
    impTotConc: Number(money(documento.no_gravado)),
    impTrib: Number(money(documento.percepciones)),
    monId: moneda,
    monCotiz: Number(monCotiz),
    condicionIvaReceptorId: condicionIva,
  }

  return {
    resumen,
    xml: `
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>${receptor.docTipo}</ar:DocTipo>
            <ar:DocNro>${receptor.docNro}</ar:DocNro>
            <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${dateToYyyymmdd(documento.fecha)}</ar:CbteFch>
            <ar:ImpTotal>${money(documento.total)}</ar:ImpTotal>
            <ar:ImpTotConc>${money(documento.no_gravado)}</ar:ImpTotConc>
            <ar:ImpNeto>${money(impNeto)}</ar:ImpNeto>
            <ar:ImpOpEx>${money(documento.exento)}</ar:ImpOpEx>
            <ar:ImpTrib>${money(documento.percepciones)}</ar:ImpTrib>
            <ar:ImpIVA>${money(documento.iva_total)}</ar:ImpIVA>
            <ar:MonId>${moneda}</ar:MonId>
            <ar:MonCotiz>${monCotiz}</ar:MonCotiz>
            <ar:CondicionIVAReceptorId>${condicionIva}</ar:CondicionIVAReceptorId>
            ${iva}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    `,
  }
}

function signLoginTicketRequest(ambiente: Ambiente): string {
  const now = new Date()
  const generation = new Date(now.getTime() - 10 * 60_000)
  const expiration = new Date(now.getTime() + 12 * 60 * 60_000)
  const tra = `<loginTicketRequest><header><uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId><generationTime>${generation.toISOString()}</generationTime><expirationTime>${expiration.toISOString()}</expirationTime></header><service>wsfe</service></loginTicketRequest>`
  const certPem = getPem(`ARCA_CERT_${envSuffix(ambiente)}`)
  const keyPem = getPem(`ARCA_KEY_${envSuffix(ambiente)}`)

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(tra, 'utf8')
  const cert = forge.pki.certificateFromPem(certPem)
  const key = forge.pki.privateKeyFromPem(keyPem)
  p7.addCertificate(cert)
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: now },
    ],
  })
  p7.sign({ detached: false })
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes())
}

async function postWsfe(ambiente: Ambiente, method: string, envelope: string): Promise<string> {
  return postSoap(URLS[ambiente].wsfe, `${WSFE_NS}${method}`, envelope)
}

async function postSoap(url: string, soapAction: string, envelope: string): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: soapAction ? `"${soapAction}"` : '',
    },
    body: envelope,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`SOAP HTTP ${response.status}: ${text.slice(0, 400)}`)
  const doc = parseXml(text)
  const fault = getFirstText(doc, 'faultstring')
  if (fault) throw new Error(fault)
  return text
}

function soapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="${SOAP_ENV}"><soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`
}

function authXml(ticket: WsaaTicket, empresa: Empresa): string {
  return `
    <ar:Auth>
      <ar:Token>${escapeXml(ticket.token)}</ar:Token>
      <ar:Sign>${escapeXml(ticket.sign)}</ar:Sign>
      <ar:Cuit>${soloNumeros(empresa.cuit)}</ar:Cuit>
    </ar:Auth>
  `
}

function ivaAlicuotasXml(items: DocumentoItem[]): string {
  const buckets = new Map<number, { base: number; importe: number }>()
  for (const item of items) {
    if (Number(item.alicuota_iva) <= 0) continue
    const id = ivaId(Number(item.alicuota_iva))
    const current = buckets.get(id) ?? { base: 0, importe: 0 }
    current.base += Number(item.subtotal)
    current.importe += Number(item.iva_importe)
    buckets.set(id, current)
  }
  if (!buckets.size) return ''
  const rows = [...buckets.entries()]
    .map(([id, values]) => `
      <ar:AlicIva>
        <ar:Id>${id}</ar:Id>
        <ar:BaseImp>${money(values.base)}</ar:BaseImp>
        <ar:Importe>${money(values.importe)}</ar:Importe>
      </ar:AlicIva>
    `)
    .join('')
  return `<ar:Iva>${rows}</ar:Iva>`
}

function letraParaFactura(empresa: Empresa, cliente: Cliente | null): 'A' | 'B' | 'C' {
  if (empresa.condicion_iva !== 'responsable_inscripto') return 'C'
  return cliente?.condicion_iva === 'responsable_inscripto' ? 'A' : 'B'
}

function tipoComprobanteFiscal(tipoDocumento: string, letra: 'A' | 'B' | 'C'): number {
  const table: Record<string, Record<'A' | 'B' | 'C', number>> = {
    factura: { A: 1, B: 6, C: 11 },
    nota_debito: { A: 2, B: 7, C: 12 },
    nota_credito: { A: 3, B: 8, C: 13 },
  }
  const code = table[tipoDocumento]?.[letra]
  if (!code) throw new Error(`Tipo de comprobante fiscal no soportado: ${tipoDocumento} ${letra}`)
  return code
}

function receptorFiscal(cliente: Cliente | null): { docTipo: number; docNro: string } {
  if (!cliente?.numero_documento) return { docTipo: 99, docNro: '0' }
  return {
    docTipo: tipoDocumentoReceptor(cliente.tipo_documento),
    docNro: soloNumeros(cliente.numero_documento) || '0',
  }
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

function condicionIvaReceptorId(condicion: string): number {
  const table: Record<string, number> = {
    responsable_inscripto: 1,
    exento: 4,
    consumidor_final: 5,
    monotributo: 6,
    no_categorizado: 7,
  }
  return table[condicion] ?? 5
}

function ivaId(alicuota: number): number {
  const table = new Map<number, number>([
    [0, 3],
    [2.5, 9],
    [5, 8],
    [10.5, 4],
    [21, 5],
    [27, 6],
  ])
  const id = table.get(alicuota)
  if (!id) throw new Error(`Alicuota IVA no soportada por WSFE: ${alicuota}`)
  return id
}

function collectCodeMsg(doc: Document, tagName: string) {
  const nodes = Array.from(doc.getElementsByTagName('*')).filter(node => node.localName === tagName)
  return nodes.map(node => ({
    code: Number(getFirstText(node, 'Code') ?? 0),
    msg: getFirstText(node, 'Msg') ?? '',
  }))
}

function formatCodeMsgs(items: Array<{ code: number; msg: string }>) {
  return items.map(item => `${item.code} ${item.msg}`.trim()).join('; ')
}

function getFirstText(root: Document | Element, localName: string): string | null {
  const nodes = Array.from(root.getElementsByTagName('*'))
  const node = nodes.find(item => item.localName === localName)
  return node?.textContent?.trim() || null
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const parserError = getFirstText(doc, 'parsererror')
  if (parserError) throw new Error(`XML invalido: ${parserError}`)
  return doc
}

function json(payload: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  })
}

function parseAmbiente(input: unknown): Ambiente {
  return input === 'produccion' ? 'produccion' : 'homologacion'
}

function assertHomologacion(ambiente: Ambiente) {
  if (ambiente !== 'homologacion') {
    throw new Error('Produccion ARCA queda bloqueada hasta Fase 6')
  }
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta configurar ${name}`)
  return value
}

function getPem(name: string): string {
  const raw = Deno.env.get(name)
  if (raw) return raw.replace(/\\n/g, '\n').trim()
  const b64 = Deno.env.get(`${name}_B64`)
  if (b64) return atob(b64).replace(/\\n/g, '\n').trim()
  throw new Error(`Falta configurar ${name} o ${name}_B64`)
}

function envSuffix(ambiente: Ambiente): string {
  return ambiente === 'homologacion' ? 'HOMOLOGACION' : 'PRODUCCION'
}

function money(value: number): string {
  return (Math.round(Number(value) * 100) / 100).toFixed(2)
}

function soloNumeros(value: string): string {
  return value.replace(/\D/g, '')
}

function dateToYyyymmdd(value: string): string {
  return value.replaceAll('-', '')
}

function yyyymmddToDate(value: string | null): string | null {
  if (!value || value.length !== 8) return null
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
