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
