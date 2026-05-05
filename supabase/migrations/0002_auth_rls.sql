-- 0002_auth_rls.sql
-- Activa Supabase Auth como obligatorio.
-- Cada usuario pertenece a una empresa via empresa_usuarios.
-- Reemplaza las RLS "anon full access" por reglas basadas en auth.uid().

-- =========================================================================
-- 1. Membership: usuarios -> empresas con rol
-- =========================================================================

create table if not exists public.empresa_usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'admin' check (rol in ('admin', 'operador', 'lectura')),
  created_at timestamptz not null default now(),
  unique (empresa_id, user_id)
);

create index if not exists idx_empresa_usuarios_user on public.empresa_usuarios (user_id);

alter table public.empresa_usuarios enable row level security;

drop policy if exists "users read own membership" on public.empresa_usuarios;
create policy "users read own membership" on public.empresa_usuarios
for select to authenticated
using (user_id = auth.uid());

-- En v1 el alta de membership se hace via SQL/admin, no desde el cliente.

-- =========================================================================
-- 2. Helper: empresas a las que pertenece el usuario actual
-- =========================================================================

create or replace function public.current_empresa_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.empresa_usuarios where user_id = auth.uid();
$$;

grant execute on function public.current_empresa_ids() to authenticated;

-- =========================================================================
-- 3. Reemplazar policies anon -> authenticated (por empresa)
-- =========================================================================

-- Tablas con columna empresa_id directa
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'puntos_venta','clientes','proveedores','productos',
      'documentos','arca_comprobantes','stock_movimientos'
    ])
  loop
    execute format('drop policy if exists "anon full access %1$s" on public.%1$s;', t);
    execute format(
      'create policy "auth empresa select %1$s" on public.%1$s for select to authenticated using (empresa_id in (select public.current_empresa_ids()));',
      t
    );
    execute format(
      'create policy "auth empresa insert %1$s" on public.%1$s for insert to authenticated with check (empresa_id in (select public.current_empresa_ids()));',
      t
    );
    execute format(
      'create policy "auth empresa update %1$s" on public.%1$s for update to authenticated using (empresa_id in (select public.current_empresa_ids())) with check (empresa_id in (select public.current_empresa_ids()));',
      t
    );
    execute format(
      'create policy "auth empresa delete %1$s" on public.%1$s for delete to authenticated using (empresa_id in (select public.current_empresa_ids()));',
      t
    );
  end loop;
end $$;

-- empresas: el usuario solo ve la(s) suya(s)
drop policy if exists "anon full access empresas" on public.empresas;
create policy "auth empresa select empresas" on public.empresas
for select to authenticated
using (id in (select public.current_empresa_ids()));
create policy "auth empresa update empresas" on public.empresas
for update to authenticated
using (id in (select public.current_empresa_ids()))
with check (id in (select public.current_empresa_ids()));

-- documento_items: heredan de documentos
drop policy if exists "anon full access documento_items" on public.documento_items;
create policy "auth doc items select" on public.documento_items
for select to authenticated
using (
  documento_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
);
create policy "auth doc items insert" on public.documento_items
for insert to authenticated
with check (
  documento_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
);
create policy "auth doc items update" on public.documento_items
for update to authenticated
using (
  documento_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
)
with check (
  documento_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
);
create policy "auth doc items delete" on public.documento_items
for delete to authenticated
using (
  documento_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
);

-- documento_relaciones: idem
drop policy if exists "anon full access documento_relaciones" on public.documento_relaciones;
create policy "auth doc rel select" on public.documento_relaciones
for select to authenticated
using (
  origen_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
);
create policy "auth doc rel insert" on public.documento_relaciones
for insert to authenticated
with check (
  origen_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
);
create policy "auth doc rel delete" on public.documento_relaciones
for delete to authenticated
using (
  origen_id in (
    select id from public.documentos
    where empresa_id in (select public.current_empresa_ids())
  )
);

-- =========================================================================
-- 4. Tablas legadas (categorias, cuentas, movimientos, configuracion):
--    pasamos de "anon full access" a "authenticated full access".
--    Mantenemos el modelo simple (sin empresa_id) en v1; se podra
--    multi-tenantizar en una migracion futura.
-- =========================================================================

do $$
declare
  t text;
begin
  for t in select unnest(array['categorias','cuentas','movimientos','configuracion'])
  loop
    execute format('drop policy if exists "anon full access %1$s" on public.%1$s;', t);
    execute format(
      'create policy "auth full access %1$s" on public.%1$s for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

revoke select, insert, update, delete on public.empresas from anon;
revoke select, insert, update, delete on public.puntos_venta from anon;
revoke select, insert, update, delete on public.clientes from anon;
revoke select, insert, update, delete on public.proveedores from anon;
revoke select, insert, update, delete on public.productos from anon;
revoke select, insert, update, delete on public.documentos from anon;
revoke select, insert, update, delete on public.documento_items from anon;
revoke select, insert, update, delete on public.documento_relaciones from anon;
revoke select, insert, update, delete on public.arca_comprobantes from anon;
revoke select, insert, update, delete on public.stock_movimientos from anon;
revoke select, insert, update, delete on public.categorias from anon;
revoke select, insert, update, delete on public.cuentas from anon;
revoke select, insert, update, delete on public.movimientos from anon;
revoke select, insert, update, delete on public.configuracion from anon;
