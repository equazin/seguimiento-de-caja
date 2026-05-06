# Roadmap

Estado al 2026-05-06. Mantengo este archivo como fuente de verdad de lo
faltante, separado por bloqueante / alto impacto / medio / nice to have.

## Hecho hasta ahora

- Fase 1: schema AFIP, Auth obligatorio, RLS por empresa, sidebar.
- Fase 2: catalogo (clientes, proveedores, productos).
- Fase 3: documentos de venta (presupuesto/pedido/remito/factura) con
  totales y numeracion interna.
- Fase 4: Edge Function `arca` con WSAA + WSFEv1 homologacion
  (`dummy`/`login`/`ultimo`/`emitir`), tabla `arca_wsaa_tokens`, panel
  Fiscal con prueba de conexion.
- Fase 5 parcial: PDF con QR fiscal, modulo Compras manual, stock
  automatico via `stock_movimientos`.
- Editor de documento como pagina dedicada para ventas/compras:
  `/ventas/nuevo`, `/ventas/:id`, `/compras/nuevo`, `/compras/:id`.
- Auto-movimiento de caja para facturas confirmadas/emitidas con cuenta
  seleccionada; ventas generan ingreso, compras generan egreso, y se
  limpian al anular/volver a borrador/eliminar.
- Conversion entre documentos operativos: presupuesto -> pedido ->
  remito -> factura, copiando items y registrando `documento_relaciones`.
- Notas de credito/debito internas desde facturas de venta/compra, con
  relacion al comprobante origen; NC revierte stock y caja cuando se
  confirma con cuenta seleccionada.
- Editor con busqueda para clientes/proveedores/productos, modo solo
  lectura en documentos cerrados y vista de relaciones origen/destino.
- Validaciones de datos: CUIT/CUIL con digito verificador en contactos y
  empresa emisora, fechas/items/tipo de cambio en documentos, y
  cotizacion USD con fecha de actualizacion.
- UX: ActionMenu global, RowActionsMenu, EmptyState, sidebar con
  identidad real, errores ARCA parseados, dashboard con chips
  navegables y deltas vs mes anterior, drawer mobile.

---

## Criterio de prioridad

Todo lo relacionado con ARCA/AFIP fiscal queda para el ultimo paso antes
del funcionamiento al 100%: certificados, keys, secretos, homologacion,
produccion, deploy definitivo de funciones y emision fiscal real.

Mientras tanto, la prioridad es dejar solido el circuito operativo interno:
catalogo, ventas, compras, stock, caja, conversion entre documentos,
notas internas y reportes basicos.

---

## Ultimo paso: ARCA / claves / emision fiscal

Estos son requisitos de infra/fiscal que se hacen al final. Sin esto,
"Emitir ARCA" puede responder 404 / cert invalido, pero no bloquea el
desarrollo del circuito interno.

1. **Configurar secretos en Supabase** (`supabase secrets set`):
   - `ARCA_CERT_HOMOLOGACION` (PEM o `*_B64`).
   - `ARCA_KEY_HOMOLOGACION`.
   - Ya estan los normales: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`.
2. **Deploy de la edge function** (`supabase functions deploy arca
   --no-verify-jwt`).
3. **Habilitar punto de venta WS en ARCA** (portal AFIP) y dejarlo
   cargado en `puntos_venta`.

4. **Producir en ARCA** (Fase 6 del plan original):
   - Destrabar el switch que hoy bloquea `arca_ambiente = 'produccion'`.
   - Validar emision real con cert de produccion.
   - Migrar `arca_ambiente` de la empresa cuando este listo.
5. **Completar emision fiscal real para documentos especiales**:
   - Notas de credito/debito con `CbteAsoc`.
   - Validaciones finales por tipo de comprobante.

Despues de esto: probar `dummy` -> `login` -> `ultimo` -> `emitir` en
homologacion con una factura C de prueba, y recien despues pasar a
produccion.

---

## Alto impacto (proxima sesion)

Cosas que cambian la experiencia de usar la app dia a dia. Orden
sugerido:

4. **Ajustes finos de notas internas**
   - Validaciones avanzadas por tipo de nota y saldo pendiente.
   - La emision fiscal contra ARCA queda para el ultimo paso.

---

## Medio impacto

9. **Pagina dedicada para ver detalle de un documento** (read-only
    para confirmados/emitidos), separada del editor.
10. **Paginacion en Ventas y Compras** (Movimientos ya la tiene).

---

## Nice to have

13. Importacion masiva de catalogo desde CSV/Excel.
14. Realtime sobre tablas AFIP (hoy refresca via `notifyDataChanged()`
    despues de cada mutacion local; entre navegadores no hay realtime).
15. Atajos de teclado en el editor de documento (agregar item,
    confirmar, cerrar).
16. Reportes adicionales: IVA ventas/compras por periodo, ranking de
    clientes, productos mas vendidos.
17. Multi-empresa: el schema y RLS ya lo permiten; falta UI para
    cambiar de empresa activa cuando un usuario tiene varias.
18. Dark/light theme toggle (hoy dark fijo).

---

## Como usarlo

- Cuando arranquemos una sesion, miramos este archivo y elegimos uno o
  varios items.
- Cuando se completa, lo tachamos o lo movemos a "Hecho hasta ahora".
- Si surge algo nuevo, va a la seccion que corresponda.
