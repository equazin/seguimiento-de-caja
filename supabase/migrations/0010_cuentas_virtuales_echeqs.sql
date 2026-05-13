-- 0010_cuentas_virtuales_echeqs.sql
-- Crea 2 cuentas virtuales del sistema para acumular e-cheqs en cartera
-- (una en ARS, otra en USD). Los movimientos con metodo_pago='echeq'
-- se contabilizan en estas cuentas hasta que el echeq sea cobrado/pagado;
-- al cobrarse se transfiere a la cuenta real destino.

insert into public.cuentas (id, nombre, tipo, moneda, saldo_inicial, activa, sistema)
values
  ('cuenta-echeqs-ars', 'E-cheqs en cartera (ARS)', 'digital', 'ARS', 0, true, true),
  ('cuenta-echeqs-usd', 'E-cheqs en cartera (USD)', 'digital', 'USD', 0, true, true)
on conflict (id) do update
  set sistema = true,
      activa = true,
      tipo = 'digital';
