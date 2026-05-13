-- 0009_echeqs_multiples.sql
-- Soporta multiples e-cheqs por movimiento mediante tabla separada.
-- El recargo pasa a ser PORCENTAJE (no monto en ARS).
-- Mantiene las columnas echeq_* viejas (nullable) para compatibilidad
-- temporal; se vacían tras migrar datos.

create table if not exists public.echeqs (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references public.movimientos(id) on delete cascade,
  fecha date not null,
  librador text not null,
  numero text,
  monto numeric not null check (monto >= 0),
  cuenta_destino_id text references public.cuentas(id) on delete set null,
  recargo_pct numeric not null default 0 check (recargo_pct >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cobrado', 'rechazado', 'anulado')),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_echeqs_movimiento on public.echeqs (movimiento_id);
create index if not exists idx_echeqs_fecha on public.echeqs (fecha);
create index if not exists idx_echeqs_estado on public.echeqs (estado);

-- RLS: hereda el mismo esquema que las demas tablas legadas
alter table public.echeqs enable row level security;
drop policy if exists "auth full access echeqs" on public.echeqs;
create policy "auth full access echeqs" on public.echeqs
  for all to authenticated using (true) with check (true);
revoke select, insert, update, delete on public.echeqs from anon;

-- Migrar datos existentes: cada movimiento con echeq_fecha != NULL
-- pasa a tener 1 fila en echeqs.
insert into public.echeqs (movimiento_id, fecha, librador, monto, cuenta_destino_id, recargo_pct, estado)
select
  m.id,
  m.echeq_fecha,
  coalesce(m.echeq_librador, 'Sin especificar'),
  case
    when m.moneda_principal = 'USD' then coalesce(m.monto_usd, 0)
    else m.monto_ars
  end,
  m.echeq_cuenta_destino_id,
  case
    when m.echeq_recargo is null or m.echeq_recargo = 0 then 0
    when m.moneda_principal = 'USD' and m.monto_usd > 0 then (m.echeq_recargo / m.monto_usd) * 100
    when m.monto_ars > 0 then (m.echeq_recargo / m.monto_ars) * 100
    else 0
  end,
  'pendiente'
from public.movimientos m
where m.metodo_pago = 'echeq' and m.echeq_fecha is not null
on conflict do nothing;

-- Una vez migrados, limpiamos las columnas viejas (las dejamos por si
-- alguien necesita revisar el dato, pero las vaciamos).
update public.movimientos
set echeq_fecha = null,
    echeq_librador = null,
    echeq_cuenta_destino_id = null,
    echeq_recargo = null
where metodo_pago = 'echeq';
