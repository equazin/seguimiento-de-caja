-- 0001_afip_schema.sql
-- Modulo comercial/fiscal: empresas, catalogo, documentos, ARCA, stock.
-- Compatible con el schema legado en supabase/schema.sql.

create extension if not exists pgcrypto;

-- =========================================================================
-- 1. Empresa emisora (alcance v1: una sola empresa)
-- =========================================================================

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  nombre_fantasia text,
  cuit text not null unique,
  condicion_iva text not null check (condicion_iva in (
    'responsable_inscripto',
    'monotributo',
    'exento',
    'consumidor_final'
  )),
  domicilio_fiscal text,
  localidad text,
  provincia text,
  codigo_postal text,
  email text,
  telefono text,
  ingresos_brutos text,
  inicio_actividades date,
  arca_ambiente text not null default 'homologacion'
    check (arca_ambiente in ('homologacion', 'produccion')),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.puntos_venta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  numero integer not null check (numero between 1 and 99999),
  nombre text not null,
  tipo_emision text not null default 'electronica'
    check (tipo_emision in ('electronica', 'manual', 'controlador_fiscal')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

-- =========================================================================
-- 2. Catalogo: clientes, proveedores, productos
-- =========================================================================

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  razon_social text not null,
  nombre_fantasia text,
  tipo_documento text not null default 'CUIT'
    check (tipo_documento in ('CUIT', 'CUIL', 'DNI', 'CDI', 'LE', 'LC', 'PASAPORTE', 'OTRO')),
  numero_documento text,
  condicion_iva text not null default 'consumidor_final'
    check (condicion_iva in (
      'responsable_inscripto',
      'monotributo',
      'exento',
      'consumidor_final',
      'no_categorizado'
    )),
  email text,
  telefono text,
  domicilio text,
  localidad text,
  provincia text,
  codigo_postal text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clientes_empresa on public.clientes (empresa_id);
create index if not exists idx_clientes_doc on public.clientes (numero_documento)
  where numero_documento is not null;

create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  razon_social text not null,
  nombre_fantasia text,
  tipo_documento text not null default 'CUIT'
    check (tipo_documento in ('CUIT', 'CUIL', 'DNI', 'CDI', 'LE', 'LC', 'PASAPORTE', 'OTRO')),
  numero_documento text,
  condicion_iva text not null default 'responsable_inscripto'
    check (condicion_iva in (
      'responsable_inscripto',
      'monotributo',
      'exento',
      'consumidor_final',
      'no_categorizado'
    )),
  email text,
  telefono text,
  domicilio text,
  localidad text,
  provincia text,
  codigo_postal text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proveedores_empresa on public.proveedores (empresa_id);
create index if not exists idx_proveedores_doc on public.proveedores (numero_documento)
  where numero_documento is not null;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text,
  nombre text not null,
  descripcion text,
  tipo text not null default 'producto'
    check (tipo in ('producto', 'servicio')),
  unidad_medida text not null default 'unidad',
  precio_neto numeric not null default 0 check (precio_neto >= 0),
  alicuota_iva numeric not null default 21 check (alicuota_iva >= 0),
  stockeable boolean not null default true,
  stock_actual numeric not null default 0,
  stock_minimo numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_productos_empresa_codigo
  on public.productos (empresa_id, codigo)
  where codigo is not null;
create index if not exists idx_productos_empresa on public.productos (empresa_id);

-- =========================================================================
-- 3. Documentos comerciales (ventas y compras)
-- =========================================================================

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo_operacion text not null check (tipo_operacion in ('venta', 'compra')),
  tipo_documento text not null check (tipo_documento in (
    'pedido',
    'presupuesto',
    'remito',
    'factura',
    'nota_credito',
    'nota_debito'
  )),
  letra text check (letra in ('A', 'B', 'C', 'M', 'X', 'R')),
  estado text not null default 'borrador' check (estado in (
    'borrador',
    'confirmado',
    'emitido',
    'anulado',
    'facturado',
    'facturado_parcial',
    'remitido',
    'remitido_parcial'
  )),
  numero_interno text not null,
  punto_venta_id uuid references public.puntos_venta(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  fecha date not null default current_date,
  fecha_vencimiento date,
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  tipo_cambio numeric not null default 1 check (tipo_cambio > 0),
  subtotal numeric not null default 0,
  iva_total numeric not null default 0,
  exento numeric not null default 0,
  no_gravado numeric not null default 0,
  percepciones numeric not null default 0,
  total numeric not null default 0,
  observaciones text,
  -- Vinculo con caja: cuando un doc se cobra/paga genera un movimiento
  cuenta_id text references public.cuentas(id) on delete set null,
  movimiento_id uuid references public.movimientos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, tipo_operacion, tipo_documento, numero_interno),
  check (
    (tipo_operacion = 'venta' and proveedor_id is null) or
    (tipo_operacion = 'compra' and cliente_id is null)
  )
);

create index if not exists idx_documentos_empresa on public.documentos (empresa_id);
create index if not exists idx_documentos_fecha on public.documentos (fecha desc);
create index if not exists idx_documentos_tipo on public.documentos (tipo_operacion, tipo_documento);
create index if not exists idx_documentos_estado on public.documentos (estado);
create index if not exists idx_documentos_cliente on public.documentos (cliente_id) where cliente_id is not null;
create index if not exists idx_documentos_proveedor on public.documentos (proveedor_id) where proveedor_id is not null;

create table if not exists public.documento_items (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  orden integer not null default 0,
  codigo text,
  descripcion text not null,
  cantidad numeric not null default 1 check (cantidad >= 0),
  unidad_medida text not null default 'unidad',
  precio_unitario numeric not null default 0,
  bonificacion numeric not null default 0,
  alicuota_iva numeric not null default 21,
  iva_importe numeric not null default 0,
  subtotal numeric not null default 0,
  total numeric not null default 0
);

create index if not exists idx_documento_items_documento on public.documento_items (documento_id);

-- Relaciones entre documentos: presupuesto -> pedido -> remito -> factura
create table if not exists public.documento_relaciones (
  id uuid primary key default gen_random_uuid(),
  origen_id uuid not null references public.documentos(id) on delete cascade,
  destino_id uuid not null references public.documentos(id) on delete cascade,
  tipo_relacion text not null check (tipo_relacion in (
    'origen',          -- el destino se genero a partir del origen
    'anulacion',       -- el destino anula al origen (NC anula factura)
    'ajuste'           -- ND/NC de ajuste sobre origen
  )),
  created_at timestamptz not null default now(),
  unique (origen_id, destino_id, tipo_relacion)
);

create index if not exists idx_doc_rel_origen on public.documento_relaciones (origen_id);
create index if not exists idx_doc_rel_destino on public.documento_relaciones (destino_id);

-- =========================================================================
-- 4. ARCA / AFIP: comprobantes electronicos
-- =========================================================================

create table if not exists public.arca_comprobantes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null unique references public.documentos(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  ambiente text not null check (ambiente in ('homologacion', 'produccion')),
  punto_venta integer not null,
  tipo_comprobante integer not null,
  numero_comprobante bigint,
  cae text,
  cae_vencimiento date,
  resultado text check (resultado in ('A', 'R', 'P')),
  request_resumen jsonb,
  response_resumen jsonb,
  errores jsonb,
  observaciones jsonb,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_arca_documento on public.arca_comprobantes (documento_id);
create index if not exists idx_arca_pv_tipo_numero
  on public.arca_comprobantes (punto_venta, tipo_comprobante, numero_comprobante);

-- =========================================================================
-- 5. Stock: movimientos derivados de documentos confirmados
-- =========================================================================

create table if not exists public.stock_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  documento_id uuid references public.documentos(id) on delete set null,
  tipo text not null check (tipo in ('ingreso', 'egreso', 'ajuste')),
  cantidad numeric not null,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_producto on public.stock_movimientos (producto_id);
create index if not exists idx_stock_documento on public.stock_movimientos (documento_id)
  where documento_id is not null;

-- =========================================================================
-- 6. Triggers updated_at
-- =========================================================================

drop trigger if exists set_empresas_updated_at on public.empresas;
create trigger set_empresas_updated_at
before update on public.empresas
for each row execute function public.set_updated_at();

drop trigger if exists set_clientes_updated_at on public.clientes;
create trigger set_clientes_updated_at
before update on public.clientes
for each row execute function public.set_updated_at();

drop trigger if exists set_proveedores_updated_at on public.proveedores;
create trigger set_proveedores_updated_at
before update on public.proveedores
for each row execute function public.set_updated_at();

drop trigger if exists set_productos_updated_at on public.productos;
create trigger set_productos_updated_at
before update on public.productos
for each row execute function public.set_updated_at();

drop trigger if exists set_documentos_updated_at on public.documentos;
create trigger set_documentos_updated_at
before update on public.documentos
for each row execute function public.set_updated_at();

-- =========================================================================
-- 7. RLS: por ahora permisivo para anon (alineado con schema legado).
--    La migracion 0002 lo ajusta a auth obligatorio.
-- =========================================================================

alter table public.empresas enable row level security;
alter table public.puntos_venta enable row level security;
alter table public.clientes enable row level security;
alter table public.proveedores enable row level security;
alter table public.productos enable row level security;
alter table public.documentos enable row level security;
alter table public.documento_items enable row level security;
alter table public.documento_relaciones enable row level security;
alter table public.arca_comprobantes enable row level security;
alter table public.stock_movimientos enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'empresas','puntos_venta','clientes','proveedores','productos',
      'documentos','documento_items','documento_relaciones',
      'arca_comprobantes','stock_movimientos'
    ])
  loop
    execute format('drop policy if exists "anon full access %1$s" on public.%1$s;', t);
    execute format(
      'create policy "anon full access %1$s" on public.%1$s for all to anon using (true) with check (true);',
      t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.empresas to anon, authenticated;
grant select, insert, update, delete on public.puntos_venta to anon, authenticated;
grant select, insert, update, delete on public.clientes to anon, authenticated;
grant select, insert, update, delete on public.proveedores to anon, authenticated;
grant select, insert, update, delete on public.productos to anon, authenticated;
grant select, insert, update, delete on public.documentos to anon, authenticated;
grant select, insert, update, delete on public.documento_items to anon, authenticated;
grant select, insert, update, delete on public.documento_relaciones to anon, authenticated;
grant select, insert, update, delete on public.arca_comprobantes to anon, authenticated;
grant select, insert, update, delete on public.stock_movimientos to anon, authenticated;

-- =========================================================================
-- 8. Realtime
-- =========================================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'empresas','puntos_venta','clientes','proveedores','productos',
      'documentos','documento_items','documento_relaciones',
      'arca_comprobantes','stock_movimientos'
    ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end $$;
