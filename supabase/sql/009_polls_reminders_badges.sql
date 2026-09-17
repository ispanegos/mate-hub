-- 1) Sondaggi lampo nei gruppi: informali, nessun voto a maggioranza
--    vincolante come le proposte di gruppo, solo un conteggio pubblico.
--    Vivono nella timeline della chat (uniti ai messaggi lato client).

create table if not exists public.group_polls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  question text not null,
  created_by uuid not null references public.profiles(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_poll_votes (
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  option_id uuid not null references public.group_poll_options(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

alter table public.group_polls enable row level security;
alter table public.group_poll_options enable row level security;
alter table public.group_poll_votes enable row level security;

drop policy if exists "group_polls_select_member" on public.group_polls;
create policy "group_polls_select_member" on public.group_polls
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = group_polls.conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "group_polls_insert_member" on public.group_polls;
create policy "group_polls_insert_member" on public.group_polls
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = group_polls.conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "group_polls_update_own" on public.group_polls;
create policy "group_polls_update_own" on public.group_polls
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "group_poll_options_select_member" on public.group_poll_options;
create policy "group_poll_options_select_member" on public.group_poll_options
  for select using (
    exists (
      select 1 from public.group_polls p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = group_poll_options.poll_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "group_poll_options_insert_creator" on public.group_poll_options;
create policy "group_poll_options_insert_creator" on public.group_poll_options
  for insert with check (
    exists (
      select 1 from public.group_polls p
      where p.id = group_poll_options.poll_id and p.created_by = auth.uid() and p.status = 'open'
    )
  );

drop policy if exists "group_poll_votes_select_member" on public.group_poll_votes;
create policy "group_poll_votes_select_member" on public.group_poll_votes
  for select using (
    exists (
      select 1 from public.group_polls p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = group_poll_votes.poll_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "group_poll_votes_insert_own" on public.group_poll_votes;
create policy "group_poll_votes_insert_own" on public.group_poll_votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.group_polls p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = group_poll_votes.poll_id and p.status = 'open'
        and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "group_poll_votes_update_own" on public.group_poll_votes;
create policy "group_poll_votes_update_own" on public.group_poll_votes
  for update using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (select 1 from public.group_polls p where p.id = group_poll_votes.poll_id and p.status = 'open')
  );

alter publication supabase_realtime add table public.group_polls;
alter publication supabase_realtime add table public.group_poll_options;
alter publication supabase_realtime add table public.group_poll_votes;

-- 2) Promemoria automatici via pg_cron: evento in arrivo (il giorno prima)
--    e pagella non ancora votata (il giorno dopo la fine dell'evento).

alter table public.events add column if not exists reminder_sent_at timestamptz;
alter table public.events add column if not exists vote_reminder_sent_at timestamptz;

create or replace function public.send_event_reminders()
returns void as $$
begin
  insert into public.notifications (user_id, actor_id, type, title, body, link, conversation_id)
  select ep.user_id, null, 'event_reminder', 'Promemoria evento',
         'Domani: "' || ev.name || '"' || coalesce(' a ' || ev.location, ''),
         '/chat/' || ev.conversation_id, ev.conversation_id
  from public.events ev
  join public.event_participants ep on ep.event_id = ev.id
  where ev.reminder_sent_at is null
    and ev.start_date is not null
    and ev.start_date::date = (current_date + 1)
    and not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = ev.conversation_id and cm.user_id = ep.user_id and cm.muted = true
    );

  update public.events
  set reminder_sent_at = now()
  where reminder_sent_at is null and start_date is not null and start_date::date = (current_date + 1);

  insert into public.notifications (user_id, actor_id, type, title, body, link, conversation_id)
  select ep.user_id, null, 'pagella_reminder', 'Non hai ancora votato',
         'Vota la pagella per "' || ev.name || '"',
         '/events/' || ev.id || '/rate', ev.conversation_id
  from public.events ev
  join public.event_participants ep on ep.event_id = ev.id
  where ev.vote_reminder_sent_at is null
    and coalesce(ev.end_date, ev.start_date) is not null
    and coalesce(ev.end_date, ev.start_date)::date = (current_date - 1)
    and not exists (
      select 1 from public.event_ratings er where er.event_id = ev.id and er.voter_user_id = ep.user_id
    )
    and not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = ev.conversation_id and cm.user_id = ep.user_id and cm.muted = true
    );

  update public.events
  set vote_reminder_sent_at = now()
  where vote_reminder_sent_at is null
    and coalesce(end_date, start_date) is not null
    and coalesce(end_date, start_date)::date = (current_date - 1);
end;
$$ language plpgsql security definer set search_path to 'public';

select cron.schedule(
  'send-event-reminders',
  '0 7 * * *',
  $$ select public.send_event_reminders(); $$
);

-- 3) Badge automatici: calcolati al volo confrontando l'utente col massimo
--    globale su ogni metrica, nessuna tabella di badge da mantenere.

create or replace function public.get_user_badges(p_user_id uuid)
returns text[] as $$
declare
  badges text[] := '{}';
  top_messages uuid;
  top_expenses uuid;
  top_events uuid;
  top_rated uuid;
  top_chaos uuid;
  top_reliability uuid;
begin
  select sender_id into top_messages
  from public.messages where sender_id is not null
  group by sender_id order by count(*) desc limit 1;

  select paid_by into top_expenses
  from public.expenses where paid_by is not null
  group by paid_by order by count(*) desc limit 1;

  select created_by into top_events
  from public.events where created_by is not null
  group by created_by order by count(*) desc limit 1;

  select rated_user_id into top_rated
  from public.event_ratings
  group by rated_user_id having count(*) >= 3
  order by avg(score) desc limit 1;

  select rated_user_id into top_chaos
  from public.event_ratings where stat_key = 'chaos'
  group by rated_user_id having count(*) >= 2
  order by avg(score) desc limit 1;

  select rated_user_id into top_reliability
  from public.event_ratings where stat_key = 'reliability'
  group by rated_user_id having count(*) >= 2
  order by avg(score) desc limit 1;

  if top_messages = p_user_id then badges := array_append(badges, 'chiacchierone'); end if;
  if top_expenses = p_user_id then badges := array_append(badges, 'banchiere'); end if;
  if top_events = p_user_id then badges := array_append(badges, 'organizzatore'); end if;
  if top_rated = p_user_id then badges := array_append(badges, 'favorito'); end if;
  if top_chaos = p_user_id then badges := array_append(badges, 'caos'); end if;
  if top_reliability = p_user_id then badges := array_append(badges, 'roccia'); end if;

  return badges;
end;
$$ language plpgsql stable security definer set search_path to 'public';
