# Fase 4 - ARCA homologacion

Esta fase agrega la Edge Function `arca` para homologacion. La funcion cubre:

- `dummy`: ping SOAP contra WSFEv1 homologacion.
- `login`: obtiene/cachea ticket WSAA para el servicio `wsfe`.
- `ultimo`: consulta `FECompUltimoAutorizado`.
- `emitir`: solicita CAE con `FECAESolicitar` para facturas de venta confirmadas.

Produccion queda bloqueada por codigo hasta Fase 6.

## Secretos requeridos

Configurar en Supabase:

```bash
supabase secrets set ARCA_CERT_HOMOLOGACION="-----BEGIN CERTIFICATE-----..."
supabase secrets set ARCA_KEY_HOMOLOGACION="-----BEGIN PRIVATE KEY-----..."
```

Tambien se puede usar Base64 si el entorno complica los saltos de linea:

```bash
supabase secrets set ARCA_CERT_HOMOLOGACION_B64="$(base64 -w0 cert.pem)"
supabase secrets set ARCA_KEY_HOMOLOGACION_B64="$(base64 -w0 key.pem)"
```

La funcion tambien requiere los secretos normales de Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase db push
supabase functions deploy arca --no-verify-jwt
```

Se usa `--no-verify-jwt` porque la funcion valida el JWT manualmente y luego confirma membership en `empresa_usuarios`.

## Pruebas rapidas

```bash
curl -X POST "$SUPABASE_URL/functions/v1/arca" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"dummy"}'
```

```bash
curl -X POST "$SUPABASE_URL/functions/v1/arca" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"login","empresaId":"<empresa-id>"}'
```

```bash
curl -X POST "$SUPABASE_URL/functions/v1/arca" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"ultimo","empresaId":"<empresa-id>","puntoVenta":1,"tipoComprobante":6}'
```

```bash
curl -X POST "$SUPABASE_URL/functions/v1/arca" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"emitir","documentoId":"<documento-id>"}'
```

`emitir` escribe/actualiza `arca_comprobantes`; si ARCA aprueba (`resultado = A`) marca el documento como `emitido`, guarda la letra fiscal y el punto de venta usado.
