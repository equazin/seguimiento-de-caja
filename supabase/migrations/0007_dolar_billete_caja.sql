-- 0007_dolar_billete_caja.sql
-- Soporta caja multimoneda (ARS + USD) sin perder el modelo actual.
-- 1) cuentas.sistema  -> marca cuentas no editables/borrables desde la UI.
-- 2) movimientos.moneda_principal -> CHAR(3) ARS|USD, indica en que moneda
--    se cargo el movimiento. La columna opuesta (monto_ars / monto_usd)
--    queda como conversion de referencia. Default ARS para no romper historico.
-- 3) Backfill: cada movimiento toma la moneda de su cuenta.
-- 4) Seed: cuenta sistema "Dolar Billete" (USD, efectivo).

alter table public.cuentas
  add column if not exists sistema boolean not null default false;

alter table public.movimientos
  add column if not exists moneda_principal char(3) not null default 'ARS';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'movimientos' and constraint_name = 'movimientos_moneda_principal_check'
  ) then
    alter table public.movimientos
      add constraint movimientos_moneda_principal_check
      check (moneda_principal in ('ARS','USD'));
  end if;
end$$;

-- Backfill: alinear movimientos con la moneda de su cuenta
update public.movimientos m
set moneda_principal = c.moneda
from public.cuentas c
where m.cuenta_id = c.id
  and m.moneda_principal <> c.moneda;

-- Cuenta sistema Dolar Billete (id fijo para idempotencia)
insert into public.cuentas (id, nombre, tipo, moneda, saldo_inicial, activa, sistema)
values ('cuenta-dolar-billete', 'Dólar Billete', 'efectivo', 'USD', 0, true, true)
on conflict (id) do update
  set sistema = true,
      moneda = 'USD',
      tipo = 'efectivo',
      activa = true;
