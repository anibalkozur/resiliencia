-- ResiliencIA — migración 0006: nickname para usuarios OAuth
-- El trigger original usaba solo el campo `nickname` del metadata, que Google
-- no envía, y caía en 'atleta'. Ahora cae en full_name / name antes de 'atleta'.
-- Solo afecta usuarios nuevos; los existentes conservan su nickname.
-- Autor: [BE].

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  fallback text;
begin
  fallback := coalesce(
    nullif(trim(meta ->> 'nickname'), ''),
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(trim(meta ->> 'name'), ''),
    'atleta'
  );
  insert into public.profiles (user_id, nickname, language)
  values (
    new.id,
    left(fallback, 40),
    coalesce(meta ->> 'language', 'es')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;