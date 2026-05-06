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
- UX: ActionMenu global, RowActionsMenu, EmptyState, sidebar con
  identidad real, errores ARCA parseados, dashboard con chips
  navegables y deltas vs mes anterior, drawer mobile.

---

## Bloqueante para emitir en homologacion

Estos son requisitos de infra que se hacen una vez. Sin esto, "Emitir
ARCA" responde 404 / cert invalido.

1. **Configurar secretos en Supabase** (`supabase secrets set`):
   - `ARCA_CERT_HOMOLOGACION` (PEM o `*_B64`).
   - `ARCA_KEY_HOMOLOGACION`.
   - Ya estan los normales: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`.
2. **Deploy de la edge function** (`supabase functions deploy arca
   --no-verify-jwt`).
3. **Habilitar punto de venta WS en ARCA** (portal AFIP) y dejarlo
   cargado en `puntos_venta`.

Despues de esto: probar `dummy` -> `login` -> `ultimo` -> `emitir` en
homologacion con una factura C de prueba.

---

## Alto impacto (proxima sesion)

Cosas que cambian la experiencia de usar la app dia a dia. Orden
sugerido:

4. **Editor de documento como pagina dedicada**
   - Rutas `/ventas/nuevo`, `/ventas/:id`, `/compras/nuevo`,
     `/compras/:id`.
   - Header con numero/estado/total, cuerpo con cliente + items, footer
     sticky con totales y acciones.
   - Reemplaza el modal grande actual.
   - Bonus: autocomplete con busqueda (Radix Popover ya esta en deps).
5. **Notas de credito y debito de venta**
   - UI para emitir NC/ND referenciando una factura emitida.
   - Wiring contra la function `arca` para CbteAsoc.
   - Reversion de stock en NC.
6. **Auto-movimiento de caja al emitir/cobrar**
   - Cuando se emite una factura cobrada, generar el movimiento
     correspondiente automaticamente.
   - Ya hay columnas `cuenta_id` y `movimiento_id` en `documentos`
     esperando ser usadas.
7. **Conversion entre documentos**
   - presupuesto -> pedido -> remito -> factura.
   - Mantener items y crear `documento_relaciones`.
8. **Compras: notas de credito/debito**
   - Carga manual + reversion de stock cuando corresponda.

---

## Medio impacto

9. **Producir en ARCA** (Fase 6 del plan original):
   - Destrabar el switch que hoy bloquea `arca_ambiente = 'produccion'`.
   - Validar emision real con cert de produccion.
   - Migrar `arca_ambiente` de la empresa cuando este listo.
10. **Validador de CUIT con digito verificador** en alta de
    clientes/proveedores y en empresa emisora.
11. **Cotizacion USD con timestamp**: mostrar "actualizada hace X dias"
    para no operar con valores obsoletos.
12. **Pagina dedicada para ver detalle de un documento** (read-only
    para confirmados/emitidos), separada del editor.
13. **Paginacion en Ventas y Compras** (Movimientos ya la tiene).

---

## Nice to have

14. Importacion masiva de catalogo desde CSV/Excel.
15. Realtime sobre tablas AFIP (hoy refresca via `notifyDataChanged()`
    despues de cada mutacion local; entre navegadores no hay realtime).
16. Atajos de teclado en el editor de documento (agregar item,
    confirmar, cerrar).
17. Reportes adicionales: IVA ventas/compras por periodo, ranking de
    clientes, productos mas vendidos.
18. Multi-empresa: el schema y RLS ya lo permiten; falta UI para
    cambiar de empresa activa cuando un usuario tiene varias.
19. Dark/light theme toggle (hoy dark fijo).

---

## Como usarlo

- Cuando arranquemos una sesion, miramos este archivo y elegimos uno o
  varios items.
- Cuando se completa, lo tachamos o lo movemos a "Hecho hasta ahora".
- Si surge algo nuevo, va a la seccion que corresponda.
