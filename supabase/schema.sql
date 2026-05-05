create extension if not exists pgcrypto;

create table if not exists public.categorias (
  id text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  color text not null,
  icono text not null
);

create table if not exists public.cuentas (
  id text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('banco', 'digital', 'efectivo')),
  moneda text not null check (moneda in ('ARS', 'USD')),
  saldo_inicial numeric not null default 0,
  activa boolean not null default true
);

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto_ars numeric not null check (monto_ars >= 0),
  monto_usd numeric check (monto_usd is null or monto_usd >= 0),
  tipo_cambio numeric check (tipo_cambio is null or tipo_cambio >= 0),
  categoria_id text not null,
  subcategoria text,
  descripcion text not null,
  contacto text,
  metodo_pago text not null check (metodo_pago in ('transferencia', 'mercado_pago', 'efectivo', 'debito', 'credito', 'cheque', 'crypto')),
  cuenta_id text not null references public.cuentas(id) on delete restrict,
  comprobante_url text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.configuracion (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  valor text not null
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_movimientos_updated_at on public.movimientos;
create trigger set_movimientos_updated_at
before update on public.movimientos
for each row execute function public.set_updated_at();

create index if not exists idx_movimientos_fecha on public.movimientos (fecha desc);
create index if not exists idx_movimientos_cuenta_id on public.movimientos (cuenta_id);
create index if not exists idx_movimientos_categoria_id on public.movimientos (categoria_id);
create index if not exists idx_movimientos_tipo on public.movimientos (tipo);
create index if not exists idx_movimientos_metodo_pago on public.movimientos (metodo_pago);
create index if not exists idx_movimientos_contacto on public.movimientos (contacto) where contacto is not null;
create index if not exists idx_categorias_tipo on public.categorias (tipo);
create index if not exists idx_cuentas_activas on public.cuentas (activa) where activa = true;

alter table public.categorias enable row level security;
alter table public.cuentas enable row level security;
alter table public.movimientos enable row level security;
alter table public.configuracion enable row level security;

drop policy if exists "anon full access categorias" on public.categorias;
create policy "anon full access categorias" on public.categorias
for all to anon
using (true)
with check (true);

drop policy if exists "anon full access cuentas" on public.cuentas;
create policy "anon full access cuentas" on public.cuentas
for all to anon
using (true)
with check (true);

drop policy if exists "anon full access movimientos" on public.movimientos;
create policy "anon full access movimientos" on public.movimientos
for all to anon
using (true)
with check (true);

drop policy if exists "anon full access configuracion" on public.configuracion;
create policy "anon full access configuracion" on public.configuracion
for all to anon
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.categorias to anon, authenticated;
grant select, insert, update, delete on public.cuentas to anon, authenticated;
grant select, insert, update, delete on public.movimientos to anon, authenticated;
grant select, insert, update, delete on public.configuracion to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categorias'
  ) then
    alter publication supabase_realtime add table public.categorias;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cuentas'
  ) then
    alter publication supabase_realtime add table public.cuentas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'movimientos'
  ) then
    alter publication supabase_realtime add table public.movimientos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'configuracion'
  ) then
    alter publication supabase_realtime add table public.configuracion;
  end if;
end $$;
