-- Sistema di notifiche: tabelle, RLS, realtime e trigger di invio push.
-- Da eseguire una volta sul progetto Supabase (SQL Editor o CLI).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  link text,
  conversation_id uuid references public.conversations(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "select own notifications" on public.notifications;
create policy "select own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

drop policy if exists "insert as actor" on public.notifications;
create policy "insert as actor" on public.notifications
  for insert with check (auth.uid() = actor_id or actor_id is null);

alter publication supabase_realtime add table public.notifications;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "manage own subscriptions" on public.push_subscriptions;
create policy "manage own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger: ad ogni nuova notifica invoca la Edge Function send-push (fire and forget).
-- Richiede l'estensione pg_net (abilitata di default sui progetti Supabase).
create or replace function public.trigger_send_push()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://iaqfhqqocywtcsrydhjn.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', new.title,
      'body', new.body,
      'link', new.link
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists notifications_push_trigger on public.notifications;
create trigger notifications_push_trigger
  after insert on public.notifications
  for each row execute function public.trigger_send_push();
