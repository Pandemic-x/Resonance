-- Resonance: synchronisatie tussen apparaten (Supabase)
-- Eenmalig uitvoeren in Supabase: SQL Editor -> New query -> plakken -> Run.
-- Eén rij = één versie van al je gegevens (zelfde inhoud als een back-up).
-- Per gebruiker blijven de laatste 10 versies bewaard; iedereen ziet alleen zijn eigen rijen.

create table if not exists public.sync_versies (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  grootte     integer not null,
  apparaat    text,
  gemaakt_op  timestamptz not null default now()
);

create index if not exists sync_versies_user_idx on public.sync_versies (user_id, id desc);

alter table public.sync_versies enable row level security;

drop policy if exists "eigen versies lezen" on public.sync_versies;
drop policy if exists "eigen versies toevoegen" on public.sync_versies;
drop policy if exists "eigen versies verwijderen" on public.sync_versies;
create policy "eigen versies lezen"       on public.sync_versies for select to authenticated using (user_id = auth.uid());
create policy "eigen versies toevoegen"   on public.sync_versies for insert to authenticated with check (user_id = auth.uid());
create policy "eigen versies verwijderen" on public.sync_versies for delete to authenticated using (user_id = auth.uid());

revoke all on public.sync_versies from anon, authenticated;
grant select, insert, delete on public.sync_versies to authenticated;

-- alleen de laatste 10 versies per gebruiker bewaren
create or replace function public.sync_versies_opruimen() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.sync_versies
   where user_id = new.user_id
     and id not in (select id from public.sync_versies where user_id = new.user_id order by id desc limit 10);
  return null;
end $$;

drop trigger if exists sync_versies_opruimen on public.sync_versies;
create trigger sync_versies_opruimen after insert on public.sync_versies
  for each row execute function public.sync_versies_opruimen();
