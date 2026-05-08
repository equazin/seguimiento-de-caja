-- 0006_documentos_usd_primario.sql
-- Agrega los campos USD por item y por documento. El USD pasa a ser el
-- monto principal de carga; el ARS se calcula como USD * tipo_cambio.
-- Los campos viejos en ARS se conservan para no perder datos cargados.

alter table public.documento_items
  add column if not exists precio_unitario_usd numeric,
  add column if not exists subtotal_usd numeric,
  add column if not exists iva_importe_usd numeric,
  add column if not exists total_usd numeric;

alter table public.documentos
  add column if not exists subtotal_usd numeric,
  add column if not exists iva_total_usd numeric,
  add column if not exists exento_usd numeric,
  add column if not exists no_gravado_usd numeric,
  add column if not exists percepciones_usd numeric,
  add column if not exists total_usd numeric;
