-- 0005_pedidos_fk_contactos.sql
-- Agrega FK a clientes/proveedores en pedidos para usar el catalogo
-- en lugar de texto manual. La columna text se conserva como fallback
-- y para no perder datos cargados antes.

alter table public.pedidos_compra
  add column if not exists proveedor_id uuid references public.proveedores(id) on delete set null,
  add column if not exists tipo_cambio numeric;

alter table public.pedidos_venta
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists tipo_cambio numeric;

create index if not exists idx_pedidos_compra_proveedor_id
  on public.pedidos_compra (proveedor_id) where proveedor_id is not null;
create index if not exists idx_pedidos_venta_cliente_id
  on public.pedidos_venta (cliente_id) where cliente_id is not null;
