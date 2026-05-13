-- 0008_echeq_movimientos.sql
-- Agrega soporte para metodo de pago E-cheq (cheque electronico).
-- Columnas dedicadas en movimientos para fecha de pago, librador,
-- cuenta destino (opcional) y recargo (informativo).

-- 1) Ampliar CHECK del metodo_pago para incluir 'echeq'
alter table public.movimientos
  drop constraint if exists movimientos_metodo_pago_check;

alter table public.movimientos
  add constraint movimientos_metodo_pago_check
  check (metodo_pago in (
    'transferencia',
    'mercado_pago',
    'efectivo',
    'debito',
    'credito',
    'cheque',
    'echeq',
    'crypto'
  ));

-- 2) Columnas especificas del echeq
alter table public.movimientos
  add column if not exists echeq_fecha date,
  add column if not exists echeq_librador text,
  add column if not exists echeq_cuenta_destino_id text references public.cuentas(id) on delete set null,
  add column if not exists echeq_recargo numeric check (echeq_recargo is null or echeq_recargo >= 0);

-- 3) Indice para consultar echeqs por fecha (vista E-cheqs pendientes)
create index if not exists idx_movimientos_echeq_fecha
  on public.movimientos (echeq_fecha)
  where metodo_pago = 'echeq';
