-- Badge non letto, mute per conversazione, modifica messaggi di testo.

alter table public.conversation_members add column if not exists last_read_at timestamptz not null default now();
alter table public.conversation_members add column if not exists muted boolean not null default false;
alter table public.messages add column if not exists edited_at timestamptz;

drop policy if exists "messages_update_own_text" on public.messages;
create policy "messages_update_own_text" on public.messages
  for update using (sender_id = auth.uid() and type = 'text')
  with check (sender_id = auth.uid() and type = 'text');

-- Conteggio messaggi non letti per l'utente autenticato, per conversazione.
-- Nessun parametro: usa sempre auth.uid(), cosi' non si possono leggere i
-- non letti di qualcun altro passando un id a piacere.
create or replace function public.get_unread_counts()
returns table(conversation_id uuid, unread_count bigint) as $$
  select cm.conversation_id, count(m.id) as unread_count
  from public.conversation_members cm
  join public.messages m
    on m.conversation_id = cm.conversation_id
    and m.created_at > cm.last_read_at
    and m.sender_id <> auth.uid()
  where cm.user_id = auth.uid() and cm.status = 'accepted'
  group by cm.conversation_id;
$$ language sql stable security definer set search_path to 'public';
