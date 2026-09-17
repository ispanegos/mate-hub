-- 1) Bacheca delle frasi leggendarie: pin di un messaggio esistente, visibile
--    a tutto il gruppo in una sezione dedicata cosi' non si perde nello scroll.

create table if not exists public.message_pins (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (message_id)
);

alter table public.message_pins enable row level security;

drop policy if exists "message_pins_select_member" on public.message_pins;
create policy "message_pins_select_member" on public.message_pins
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = message_pins.conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "message_pins_insert_member" on public.message_pins;
create policy "message_pins_insert_member" on public.message_pins
  for insert with check (
    pinned_by = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = message_pins.conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "message_pins_delete_own" on public.message_pins;
create policy "message_pins_delete_own" on public.message_pins
  for delete using (pinned_by = auth.uid());

alter publication supabase_realtime add table public.message_pins;

-- 2) Capsula del tempo: un messaggio testuale sigillato che nessuno, nemmeno
--    chi l'ha scritto, puo' leggere o modificare prima della data di apertura.
--    Niente policy di update/delete: e' sigillata per davvero. Il contenuto
--    esce solo dalla funzione get_time_capsules(), mai da una select diretta
--    (che infatti e' ristretta al solo autore, per non far trapelare nulla
--    via REST prima del tempo).

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  content text not null,
  opens_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.time_capsules enable row level security;

drop policy if exists "time_capsules_select_own" on public.time_capsules;
create policy "time_capsules_select_own" on public.time_capsules
  for select using (created_by = auth.uid());

drop policy if exists "time_capsules_insert_member" on public.time_capsules;
create policy "time_capsules_insert_member" on public.time_capsules
  for insert with check (
    created_by = auth.uid()
    and opens_at > now()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = time_capsules.conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

alter publication supabase_realtime add table public.time_capsules;

create or replace function public.get_time_capsules(p_conversation_id uuid)
returns table(
  id uuid, conversation_id uuid, created_by uuid, opens_at timestamptz, created_at timestamptz,
  is_open boolean, content text
) as $$
  select
    tc.id, tc.conversation_id, tc.created_by, tc.opens_at, tc.created_at,
    (tc.opens_at <= now()) as is_open,
    case when tc.opens_at <= now() then tc.content else null end as content
  from public.time_capsules tc
  where tc.conversation_id = p_conversation_id
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  order by tc.opens_at asc;
$$ language sql stable security definer set search_path to 'public';

-- 3) Meteo del gruppo: indicatore scherzoso basato sul rapporto tra
--    reazioni e messaggi nelle ultime 48 ore. Solo per i gruppi.

create or replace function public.get_group_mood(p_conversation_id uuid)
returns table(mood_key text, mood_emoji text, mood_label text, msg_count int, reaction_count int) as $$
declare
  is_member boolean;
  msgs int;
  reacts int;
  ratio numeric;
begin
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
  ) into is_member;

  if not is_member then
    return;
  end if;

  select count(*) into msgs from public.messages m
  where m.conversation_id = p_conversation_id and m.created_at >= now() - interval '48 hours';

  select count(*) into reacts from public.message_reactions mr
  join public.messages m on m.id = mr.message_id
  where m.conversation_id = p_conversation_id and mr.created_at >= now() - interval '48 hours';

  if msgs = 0 then
    return query select 'letargo', '😴', 'Gruppo in letargo', 0, 0;
    return;
  end if;

  ratio := reacts::numeric / msgs;

  if ratio >= 0.8 then
    return query select 'fuoco', '🔥', 'Gruppo in fiamme', msgs, reacts;
  elsif ratio >= 0.4 then
    return query select 'forma', '😂', 'Gruppo in forma', msgs, reacts;
  elsif ratio >= 0.15 then
    return query select 'normale', '🙂', 'Tutto normale', msgs, reacts;
  else
    return query select 'piatto', '😐', 'Clima piatto', msgs, reacts;
  end if;
end;
$$ language plpgsql stable security definer set search_path to 'public';
