-- Governance del gruppo: proposte (rename / avatar / delete) con voto a maggioranza.
-- Stesso pattern del sistema di ban gia' esistente (conversation_ban_requests/votes + trigger),
-- generalizzato a multi-opzione.

create table if not exists public.conversation_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  type text not null check (type in ('rename', 'avatar', 'delete')),
  status text not null default 'open' check (status in ('open', 'passed', 'rejected')),
  requested_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.conversation_proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.conversation_proposals(id) on delete cascade,
  value text,
  label text not null,
  is_default boolean not null default false,
  proposed_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.conversation_proposal_votes (
  proposal_id uuid not null references public.conversation_proposals(id) on delete cascade,
  option_id uuid not null references public.conversation_proposal_options(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  primary key (proposal_id, voter_id)
);

alter table public.conversation_proposals enable row level security;
alter table public.conversation_proposal_options enable row level security;
alter table public.conversation_proposal_votes enable row level security;

drop policy if exists "proposals_select_member" on public.conversation_proposals;
create policy "proposals_select_member" on public.conversation_proposals
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_proposals.conversation_id
        and cm.user_id = auth.uid()
        and cm.status = 'accepted'
    )
  );

drop policy if exists "proposals_insert_member" on public.conversation_proposals;
create policy "proposals_insert_member" on public.conversation_proposals
  for insert with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_proposals.conversation_id
        and cm.user_id = auth.uid()
        and cm.status = 'accepted'
    )
  );

drop policy if exists "proposal_options_select_member" on public.conversation_proposal_options;
create policy "proposal_options_select_member" on public.conversation_proposal_options
  for select using (
    exists (
      select 1 from public.conversation_proposals p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = conversation_proposal_options.proposal_id
        and cm.user_id = auth.uid()
        and cm.status = 'accepted'
    )
  );

drop policy if exists "proposal_options_insert_member" on public.conversation_proposal_options;
create policy "proposal_options_insert_member" on public.conversation_proposal_options
  for insert with check (
    proposed_by = auth.uid()
    and exists (
      select 1 from public.conversation_proposals p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = conversation_proposal_options.proposal_id
        and p.status = 'open'
        and cm.user_id = auth.uid()
        and cm.status = 'accepted'
    )
  );

drop policy if exists "proposal_votes_select_member" on public.conversation_proposal_votes;
create policy "proposal_votes_select_member" on public.conversation_proposal_votes
  for select using (
    exists (
      select 1 from public.conversation_proposals p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = conversation_proposal_votes.proposal_id
        and cm.user_id = auth.uid()
        and cm.status = 'accepted'
    )
  );

drop policy if exists "proposal_votes_insert_own" on public.conversation_proposal_votes;
create policy "proposal_votes_insert_own" on public.conversation_proposal_votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.conversation_proposals p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = conversation_proposal_votes.proposal_id
        and p.status = 'open'
        and cm.user_id = auth.uid()
        and cm.status = 'accepted'
    )
  );

drop policy if exists "proposal_votes_update_own" on public.conversation_proposal_votes;
create policy "proposal_votes_update_own" on public.conversation_proposal_votes
  for update using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.conversation_proposals p
      where p.id = conversation_proposal_votes.proposal_id and p.status = 'open'
    )
  );

alter publication supabase_realtime add table public.conversation_proposals;

create or replace function public.resolve_conversation_proposal()
returns trigger as $$
declare
  prop record;
  eligible_count int;
  winner record;
  total_votes int;
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
  elsif total_votes >= eligible_count then
    update public.conversation_proposals set status = 'rejected', resolved_at = now() where id = prop.id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path to 'public';

drop trigger if exists trg_resolve_conversation_proposal on public.conversation_proposal_votes;
create trigger trg_resolve_conversation_proposal
  after insert or update on public.conversation_proposal_votes
  for each row execute function public.resolve_conversation_proposal();
