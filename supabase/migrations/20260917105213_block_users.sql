-- Blocco utenti: impedisce nuove richieste di amicizia (e quindi nuovi
-- inviti a chat/gruppi, che richiedono amicizia accettata) in entrambe le
-- direzioni. Non tocca gruppi/chat gia' esistenti (per quello c'e' il ban
-- di gruppo).

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_own" on public.blocked_users;
create policy "blocked_users_select_own" on public.blocked_users
  for select using (auth.uid() = blocker_id);

drop policy if exists "blocked_users_insert_own" on public.blocked_users;
create policy "blocked_users_insert_own" on public.blocked_users
  for insert with check (auth.uid() = blocker_id and blocked_id <> blocker_id);

drop policy if exists "blocked_users_delete_own" on public.blocked_users;
create policy "blocked_users_delete_own" on public.blocked_users
  for delete using (auth.uid() = blocker_id);

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$ language sql stable security definer set search_path to 'public';

drop policy if exists "friends_insert_own" on public.friends;
create policy "friends_insert_own" on public.friends
  for insert with check (
    auth.uid() = user_id
    and friend_id <> auth.uid()
    and not public.is_blocked(auth.uid(), friend_id)
  );
