# Plan: AFIP/ARCA, Ventas, Compras y Documentos Comerciales

## Summary

Implementar un modulo comercial/fiscal completo sobre la app actual: pedidos, presupuestos, remitos, facturas, notas de credito y notas de debito para ventas; pedidos, remitos, facturas y notas para compras. La emision fiscal real se hara contra ARCA/AFIP WSFEv1 desde Supabase Edge Functions, nunca desde el frontend.

Referencias tecnicas:

- [ARCA Webservices Factura Electronica](https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp)
- [Manual WSFEv1](https://www.afip.gob.ar/fe/ayuda/documentos/wsfev1%20_Manual-desarrollador-V.2.22.pdf)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets)

## Key Changes

- Agregar Supabase Auth obligatorio, RLS por una empresa emisora, y dejar de operar datos sensibles con acceso anonimo.
- Crear catalogo completo: clientes, proveedores, productos/servicios, listas de precios, alicuotas IVA, stock basico y configuracion fiscal.
- Crear documentos comerciales con estados: borrador, confirmado, emitido, anulado, facturado/parcial, remitido/parcial.
- Ventas: pedido, presupuesto, remito, factura A/B/C, nota de credito y nota de debito.
- Compras: pedido, remito, factura, nota de credito y nota de debito con carga manual inicial.
- Integrar facturacion real con ARCA/AFIP mediante Edge Function segura: WSAA para token/sign, WSFEv1 para CAE, ultimo comprobante, tipos de comprobante y emision.
- Generar PDF imprimible con QR fiscal para comprobantes emitidos y PDF comercial para pedidos/presupuestos/remitos.
- Registrar movimientos de caja automaticamente desde facturas/notas configuradas como cobradas/pagadas.

## Implementation Plan

1. Documento y base tecnica:
   - Agregar migraciones SQL versionadas para nuevas tablas y RLS.
   - Crear carpeta `supabase/functions/arca` con cliente SOAP propio compatible con Deno: `node-forge` para firma CMS/PKCS#7, `fetch` para WSAA/WSFEv1, secrets para CUIT/cert/key.
   - Secrets requeridos: `ARCA_ENV`, `ARCA_CUIT`, `ARCA_CERT`, `ARCA_PRIVATE_KEY`, `ARCA_PASSPHRASE` si aplica.

2. Modelo de datos:
   - Tablas principales: `empresas`, `puntos_venta`, `clientes`, `proveedores`, `productos`, `documentos`, `documento_items`, `documento_relaciones`, `arca_comprobantes`, `stock_movimientos`.
   - `documentos` tendra `tipo_operacion` venta/compra, `tipo_documento`, estado, numeracion interna, totales neto/iva/exento/no_gravado/total, moneda, contacto, fechas y referencia a cuenta/movimiento.
   - `arca_comprobantes` guardara punto de venta, tipo comprobante AFIP, numero, CAE, vencimiento CAE, request/response resumido, resultado y errores.

3. UI y flujos:
   - Agregar navegacion "Ventas", "Compras", "Catalogo" y "Fiscal".
   - Ventas: crear presupuesto/pedido, convertir a remito o factura, emitir factura/nota ante ARCA, ver PDF y detalle.
   - Compras: carga manual de comprobantes de proveedor, remitos y pedidos; al confirmar compras sumar stock basico.
   - Catalogo: CRUD de clientes/proveedores/productos, condiciones fiscales, CUIT/DNI, domicilios y precios.
   - Fiscal: configurar empresa, condicion IVA, punto de venta, ambiente homologacion/produccion y prueba de conexion.

4. Reglas de negocio:
   - Facturas/NC/ND reales solo se emiten desde backend.
   - Numeracion fiscal se obtiene con `FECompUltimoAutorizado` antes de solicitar CAE.
   - Notas de credito/debito de venta deben referenciar comprobante asociado cuando corresponda.
   - Remitos de venta descuentan stock; facturas sin remito descuentan stock al emitir si contienen productos stockeables.
   - Compras confirmadas suman stock; notas de credito de compra revierten stock si corresponde.

5. Commit, push y deploy:
   - Primer commit: `docs: add afip implementation plan`.
   - Commits posteriores por fase: schema/auth, catalog, documents, arca function, PDFs, stock.
   - Push a `main` para disparar GitHub Pages; Edge Functions se deployan con Supabase CLI.

## Test Plan

- TypeScript: `npm run typecheck`.
- Build frontend: `npm run build`.
- DB: probar migraciones desde cero y sobre base existente.
- RLS/Auth: usuario no autenticado no accede a datos; usuario autenticado accede solo a la empresa configurada.
- ARCA homologacion: emitir Factura C, Factura B, Nota de Credito y Nota de Debito; validar CAE, numeracion y errores.
- Documentos: convertir presupuesto/pedido/remito/factura sin perder items ni totales.
- Stock: venta descuenta, compra suma, notas revierten segun tipo.
- PDF: totales, datos fiscales, CAE y QR visibles.

## Assumptions

- Alcance inicial: una sola empresa emisora.
- Perfil fiscal configurable A/B/C.
- Compras ingresan por carga manual, sin consulta automatica a ARCA en v1.
- Backend principal: Supabase Edge Functions.
- El frontend en GitHub Pages nunca guarda certificados, claves privadas ni `service_role`.
