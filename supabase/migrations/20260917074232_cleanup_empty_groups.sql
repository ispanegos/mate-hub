-- Se l'ultimo membro accettato esce da un gruppo (o viene rimosso per ban),
-- il gruppo resta orfano per sempre: nessuno potrebbe piu' votarne
-- l'eliminazione (servono membri accettati per essere eleggibili al voto).
-- Questo trigger elimina il gruppo quando non ha piu' nessun membro accettato.

create or replace function public.cleanup_empty_group()
returns trigger as $$
begin
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = old.conversation_id and status = 'accepted'
  ) then
    delete from public.conversations
    where id = old.conversation_id and type = 'group';
  end if;
  return old;
end;
$$ language plpgsql security definer set search_path to 'public';

drop trigger if exists trg_cleanup_empty_group on public.conversation_members;
create trigger trg_cleanup_empty_group
  after delete on public.conversation_members
  for each row execute function public.cleanup_empty_group();
