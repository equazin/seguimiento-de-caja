-- 0003_arca_wsaa_tokens.sql
-- Cache interno de tickets WSAA para Edge Functions ARCA.
-- No se expone al cliente: se usa solamente con service role desde la funcion.

create table if not exists public.arca_wsaa_tokens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  ambiente text not null check (ambiente in ('homologacion', 'produccion')),
  service text not null default 'wsfe',
  token text not null,
  sign text not null,
  generation_time timestamptz,
  expiration_time timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, ambiente, service)
);

drop trigger if exists set_arca_wsaa_tokens_updated_at on public.arca_wsaa_tokens;
create trigger set_arca_wsaa_tokens_updated_at
before update on public.arca_wsaa_tokens
for each row execute function public.set_updated_at();

alter table public.arca_wsaa_tokens enable row level security;

revoke select, insert, update, delete on public.arca_wsaa_tokens from anon;
revoke select, insert, update, delete on public.arca_wsaa_tokens from authenticated;
