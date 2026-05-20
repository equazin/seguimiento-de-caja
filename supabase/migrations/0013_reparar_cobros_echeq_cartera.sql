-- 0013_reparar_cobros_echeq_cartera.sql
-- Repara cobros de e-cheq historicos que registraron la entrada al banco
-- pero no la contrapartida de salida desde "E-cheqs en cartera (ARS)".

insert into public.movimientos (
  id,
  fecha,
  tipo,
  monto_ars,
  monto_usd,
  tipo_cambio,
  moneda_principal,
  categoria_id,
  subcategoria,
  descripcion,
  contacto,
  metodo_pago,
  cuenta_id,
  comprobante_url,
  notas,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  real.fecha,
  case when real.tipo = 'ingreso' then 'egreso' else 'ingreso' end,
  real.monto_ars,
  real.monto_usd,
  real.tipo_cambio,
  real.moneda_principal,
  real.categoria_id,
  real.subcategoria,
  real.descripcion,
  real.contacto,
  real.metodo_pago,
  'cuenta-echeqs-ars',
  real.comprobante_url,
  real.notas,
  real.created_at,
  now()
from public.movimientos real
where real.notas like '%[cobro_echeq:%'
  and real.notas not like '%[impuestos:%'
  and real.cuenta_id <> 'cuenta-echeqs-ars'
  and not exists (
    select 1
    from public.movimientos virtual
    where virtual.notas = real.notas
      and virtual.cuenta_id = 'cuenta-echeqs-ars'
  );
