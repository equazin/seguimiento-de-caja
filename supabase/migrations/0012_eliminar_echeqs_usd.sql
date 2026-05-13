-- 0012_eliminar_echeqs_usd.sql
-- Quita la cuenta virtual de e-cheqs en USD. Solo se trabaja con e-cheqs en ARS.
-- Si hubiera movimientos asociados (raros), los reasigna a Banco BBVA por seguridad.

-- 1) Reasignar movimientos por si hay alguno en la virtual USD
update public.movimientos
set cuenta_id = '29ef9e07-9aae-4d50-831c-c7351f445463'
where cuenta_id = 'cuenta-echeqs-usd';

-- 2) Eliminar la cuenta virtual USD (ya no se usa)
delete from public.cuentas where id = 'cuenta-echeqs-usd';
