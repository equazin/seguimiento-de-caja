-- Pedidos de compra (órdenes de pago a proveedores)
CREATE TABLE IF NOT EXISTS pedidos_compra (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            text        NOT NULL,
  proveedor         text        NOT NULL,
  fecha             date        NOT NULL,
  fecha_vencimiento date,
  estado            text        NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente','pagado_parcial','pagado_total','cancelado')),
  monto_total       numeric     NOT NULL DEFAULT 0,
  monto_total_usd   numeric,
  descripcion       text,
  items             jsonb,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Pedidos de venta (cobros a clientes)
CREATE TABLE IF NOT EXISTS pedidos_venta (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            text        NOT NULL,
  cliente           text        NOT NULL,
  fecha             date        NOT NULL,
  fecha_vencimiento date,
  estado            text        NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente','cobrado_parcial','cobrado_total','cancelado')),
  monto_total       numeric     NOT NULL DEFAULT 0,
  monto_total_usd   numeric,
  descripcion       text,
  items             jsonb,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Vínculos M:N entre movimientos y pedidos
CREATE TABLE IF NOT EXISTS movimiento_vinculos (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id    uuid    NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
  pedido_compra_id uuid    REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  pedido_venta_id  uuid    REFERENCES pedidos_venta(id)  ON DELETE CASCADE,
  monto_aplicado   numeric NOT NULL DEFAULT 0,
  notas            text,
  CONSTRAINT vinculo_exactamente_uno CHECK (
    (pedido_compra_id IS NOT NULL)::int + (pedido_venta_id IS NOT NULL)::int = 1
  )
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_estado  ON pedidos_compra (estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_fecha   ON pedidos_compra (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_venta_estado   ON pedidos_venta  (estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_venta_fecha    ON pedidos_venta  (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_vinculos_movimiento    ON movimiento_vinculos (movimiento_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_compra        ON movimiento_vinculos (pedido_compra_id) WHERE pedido_compra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vinculos_venta         ON movimiento_vinculos (pedido_venta_id)  WHERE pedido_venta_id  IS NOT NULL;

-- RLS: mismas políticas que el resto de las tablas (auth requerida)
ALTER TABLE pedidos_compra     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_venta      ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados_pedidos_compra"     ON pedidos_compra     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados_pedidos_venta"      ON pedidos_venta      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados_movimiento_vinculos" ON movimiento_vinculos FOR ALL TO authenticated USING (true) WITH CHECK (true);
