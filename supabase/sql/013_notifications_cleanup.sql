-- Le notifiche di un'azione gia' risolta (proposta di gruppo chiusa,
-- sondaggio chiuso) non servono piu': vengono segnate lette cosi'
-- spariscono dal pannello (che ora mostra solo le non lette). Le notifiche
-- di richiesta amicizia/invito gruppo vengono ripulite lato client quando
-- l'utente risponde (useFriends.respond, HomePage.respondInvite).

create or replace function public.resolve_conversation_proposal()
returns trigger as $$
declare
  prop record;
  eligible_count int;
  winner record;
  total_votes int;
  resolved boolean := false;
begin
  select * into prop from public.conversation_proposals where id = new.proposal_id for update;
  if prop.status <> 'open' then
    return new;
  end if;

  select count(*) into eligible_count
  from public.conversation_members
  where conversation_id = prop.conversation_id and status = 'accepted';

  select option_id, count(*) as votes into winner
  from public.conversation_proposal_votes
  where proposal_id = prop.id
  group by option_id
  order by count(*) desc
  limit 1;

  select count(*) into total_votes from public.conversation_proposal_votes where proposal_id = prop.id;

  if winner.votes > eligible_count / 2 then
    if (select is_default from public.conversation_proposal_options where id = winner.option_id) then
      update public.conversation_proposals set status = 'rejected', resolved_at = now() where id = prop.id;
    else
      update public.conversation_proposals set status = 'passed', resolved_at = now() where id = prop.id;

      if prop.type = 'rename' then
        update public.conversations
          set name = (select value from public.conversation_proposal_options where id = winner.option_id)
          where id = prop.conversation_id;
      elsif prop.type = 'avatar' then
        update public.conversations
          set avatar_url = (select value from public.conversation_proposal_options where id = winner.option_id)
          where id = prop.conversation_id;
      elsif prop.type = 'delete' then
        delete from public.conversations where id = prop.conversation_id;
      end if;
    end if;
    resolved := true;
  elsif total_votes >= eligible_count then
    update public.conversation_proposals set status = 'rejected', resolved_at = now() where id = prop.id;
    resolved := true;
  end if;

  if resolved then
    update public.notifications
    set read = true
    where type = 'group_proposal' and conversation_id = prop.conversation_id and read = false;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path to 'public';

create or replace function public.clear_poll_notifications()
returns trigger as $$
begin
  if new.status = 'closed' and old.status <> 'closed' then
    update public.notifications
    set read = true
    where type = 'poll' and conversation_id = new.conversation_id and read = false;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path to 'public';

drop trigger if exists trg_clear_poll_notifications on public.group_polls;
create trigger trg_clear_poll_notifications
  after update on public.group_polls
  for each row execute function public.clear_poll_notifications();
