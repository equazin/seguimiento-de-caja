-- 0011_reasignar_echeqs_y_cuentas.sql
-- 1) Reasigna movimientos con metodo_pago='echeq' a la cuenta virtual
--    correspondiente segun moneda_principal. Esto corrige movimientos
--    cargados antes de la migracion 0010.
-- 2) Desactiva cuentas que el usuario no usa (Banco Macro, Mercado Pago).
--    Las mantenemos como activa=false para no perder historial; si
--    quisieras eliminarlas habria que decidir que hacer con sus mov.

-- 1) Reasignar movimientos echeq a cuentas virtuales
update public.movimientos
set cuenta_id = case
  when moneda_principal = 'USD' then 'cuenta-echeqs-usd'
  else 'cuenta-echeqs-ars'
end
where metodo_pago = 'echeq'
  and cuenta_id not in ('cuenta-echeqs-ars', 'cuenta-echeqs-usd');

-- 2) Desactivar cuentas no usadas
update public.cuentas
set activa = false
where id in ('cuenta-macro', 'cuenta-mp');
