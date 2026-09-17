-- Cestino per i messaggi di testo: eliminazione = soft delete (deleted_at),
-- svuotato automaticamente a fine giornata (fuso Europe/Rome) da pg_cron.
-- I media restano a eliminazione diretta come prima (nessuna gestione di
-- file orfani su Storage via SQL puro).

alter table public.messages add column if not exists deleted_at timestamptz;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'purge-daily-trash',
  '*/30 * * * *',
  $$
  delete from public.messages
  where deleted_at is not null
    and type = 'text'
    and deleted_at < date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  $$
);

-- Ricerca amici tollerante: nome, cognome, username o email esatta.
create or replace function public.find_profile_by_email(p_email text)
returns public.profiles as $$
  select p.* from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(p_email)
  limit 1;
$$ language sql stable security definer set search_path to 'public';
