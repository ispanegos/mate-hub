-- Recap del lunedi': ogni lunedi mattina, per ogni gruppo che ha avuto
-- attivita' nell'ultima settimana, un messaggio di sistema (sender_id null,
-- type 'system') riassume la settimana e nomina chi ha vinto i 3 badge
-- piu' "sociali" del gruppo. Vive nella timeline come un messaggio normale,
-- quindi eredita gratis realtime e conteggio non letti.

-- get_unread_counts() escludeva i messaggi di sistema (sender_id null):
-- "sender_id <> auth.uid()" e' NULL, non true, quando sender_id e' null.
create or replace function public.get_unread_counts()
returns table(conversation_id uuid, unread_count bigint) as $$
  select cm.conversation_id, count(m.id) as unread_count
  from public.conversation_members cm
  join public.messages m
    on m.conversation_id = cm.conversation_id
    and m.created_at > cm.last_read_at
    and (m.sender_id is null or m.sender_id <> auth.uid())
  where cm.user_id = auth.uid() and cm.status = 'accepted'
  group by cm.conversation_id;
$$ language sql stable security definer set search_path to 'public';

create or replace function public.send_weekly_recap()
returns void as $$
declare
  conv record;
  msg_count int;
  event_count int;
  expense_count int;
  top_chatter text;
  top_banker text;
  top_organizer text;
  content text;
begin
  for conv in
    select c.id from public.conversations c
    where c.type = 'group'
      and exists (
        select 1 from public.messages m
        where m.conversation_id = c.id and m.created_at >= now() - interval '7 days'
      )
  loop
    select count(*) into msg_count from public.messages
      where conversation_id = conv.id and created_at >= now() - interval '7 days' and sender_id is not null;

    select count(*) into event_count from public.events
      where conversation_id = conv.id and created_at >= now() - interval '7 days';

    select count(*) into expense_count from public.expenses
      where conversation_id = conv.id and created_at >= now() - interval '7 days';

    select coalesce(nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), ''), p.username) into top_chatter
    from public.messages m join public.profiles p on p.id = m.sender_id
    where m.conversation_id = conv.id and m.sender_id is not null and m.created_at >= now() - interval '7 days'
    group by p.id, p.first_name, p.last_name, p.username order by count(*) desc limit 1;

    select coalesce(nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), ''), p.username) into top_banker
    from public.expenses e join public.profiles p on p.id = e.paid_by
    where e.conversation_id = conv.id and e.paid_by is not null and e.created_at >= now() - interval '7 days'
    group by p.id, p.first_name, p.last_name, p.username order by count(*) desc limit 1;

    select coalesce(nullif(trim(p.first_name || ' ' || coalesce(p.last_name, '')), ''), p.username) into top_organizer
    from public.events ev join public.profiles p on p.id = ev.created_by
    where ev.conversation_id = conv.id and ev.created_by is not null and ev.created_at >= now() - interval '7 days'
    group by p.id, p.first_name, p.last_name, p.username order by count(*) desc limit 1;

    content := '📊 Recap della settimana: ' || msg_count || ' messaggi';
    if event_count > 0 then content := content || ', ' || event_count || ' eventi'; end if;
    if expense_count > 0 then content := content || ', ' || expense_count || ' spese'; end if;
    content := content || '.';
    if top_chatter is not null then content := content || E'\n🎤 Chiacchierone: ' || top_chatter; end if;
    if top_banker is not null then content := content || E'\n💰 Banchiere: ' || top_banker; end if;
    if top_organizer is not null then content := content || E'\n📅 Organizzatore: ' || top_organizer; end if;

    insert into public.messages (conversation_id, sender_id, type, content)
    values (conv.id, null, 'system', content);

    top_chatter := null;
    top_banker := null;
    top_organizer := null;
  end loop;
end;
$$ language plpgsql security definer set search_path to 'public';

select cron.schedule(
  'send-weekly-recap',
  '0 8 * * 1',
  $$ select public.send_weekly_recap(); $$
);
