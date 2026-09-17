-- 4 badge in piu': Il Popolare (reazioni ricevute), Lo Spiantato (quote di
-- spesa ancora da pagare, stato attuale, non a finestra), Il
-- Soprannominato (nickname ricevuti, globale: la tabella nicknames non e'
-- legata a un gruppo) e Il Vocale-dipendente (messaggi audio).

create or replace function public.get_user_badges(p_user_id uuid)
returns table(badge_key text, conversation_id uuid, conversation_name text) as $$
with win as (
  select now() - interval '7 days' as since
),
visible_convs as (
  select cm1.conversation_id from public.conversation_members cm1
  join public.conversation_members cm2 on cm2.conversation_id = cm1.conversation_id
  join public.conversations c on c.id = cm1.conversation_id
  where cm1.user_id = p_user_id and cm1.status = 'accepted'
    and cm2.user_id = auth.uid() and cm2.status = 'accepted'
    and c.type = 'group'
),
msg_counts as (
  select m.conversation_id, m.sender_id as uid, count(*) as n
  from public.messages m, win w
  where m.sender_id is not null and m.created_at >= w.since
    and m.conversation_id in (select conversation_id from visible_convs)
  group by m.conversation_id, m.sender_id
),
msg_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from msg_counts
),
night_counts as (
  select m.conversation_id, m.sender_id as uid, count(*) as n
  from public.messages m, win w
  where m.sender_id is not null and m.created_at >= w.since
    and m.conversation_id in (select conversation_id from visible_convs)
    and extract(hour from (m.created_at at time zone 'Europe/Rome')) between 0 and 4
  group by m.conversation_id, m.sender_id
),
night_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from night_counts
),
media_counts as (
  select md.conversation_id, md.uploaded_by as uid, count(*) as n
  from public.media md, win w
  where md.uploaded_by is not null and md.created_at >= w.since
    and md.conversation_id in (select conversation_id from visible_convs)
  group by md.conversation_id, md.uploaded_by
),
media_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from media_counts
),
expense_counts as (
  select e.conversation_id, e.paid_by as uid, count(*) as n
  from public.expenses e, win w
  where e.paid_by is not null and e.created_at >= w.since
    and e.conversation_id in (select conversation_id from visible_convs)
  group by e.conversation_id, e.paid_by
),
expense_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from expense_counts
),
event_counts as (
  select ev.conversation_id, ev.created_by as uid, count(*) as n
  from public.events ev, win w
  where ev.created_by is not null and ev.created_at >= w.since
    and ev.conversation_id in (select conversation_id from visible_convs)
  group by ev.conversation_id, ev.created_by
),
event_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from event_counts
),
vote_counts as (
  select ev.conversation_id, er.voter_user_id as uid, count(distinct er.event_id) as n
  from public.event_ratings er
  join public.events ev on ev.id = er.event_id, win w
  where er.created_at >= w.since and ev.conversation_id in (select conversation_id from visible_convs)
  group by ev.conversation_id, er.voter_user_id
),
vote_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from vote_counts
),
rating_avg as (
  select ev.conversation_id, er.rated_user_id as uid, avg(er.score) as avg_score, count(*) as n
  from public.event_ratings er
  join public.events ev on ev.id = er.event_id, win w
  where er.created_at >= w.since and ev.conversation_id in (select conversation_id from visible_convs)
  group by ev.conversation_id, er.rated_user_id
  having count(*) >= 3
),
rating_rank as (
  select *, rank() over (partition by conversation_id order by avg_score desc) as rnk from rating_avg
),
chaos_avg as (
  select ev.conversation_id, er.rated_user_id as uid, avg(er.score) as avg_score, count(*) as n
  from public.event_ratings er
  join public.events ev on ev.id = er.event_id, win w
  where er.created_at >= w.since and er.stat_key = 'chaos'
    and ev.conversation_id in (select conversation_id from visible_convs)
  group by ev.conversation_id, er.rated_user_id
  having count(*) >= 2
),
chaos_rank as (
  select *, rank() over (partition by conversation_id order by avg_score desc) as rnk from chaos_avg
),
reliability_avg as (
  select ev.conversation_id, er.rated_user_id as uid, avg(er.score) as avg_score, count(*) as n
  from public.event_ratings er
  join public.events ev on ev.id = er.event_id, win w
  where er.created_at >= w.since and er.stat_key = 'reliability'
    and ev.conversation_id in (select conversation_id from visible_convs)
  group by ev.conversation_id, er.rated_user_id
  having count(*) >= 2
),
reliability_rank as (
  select *, rank() over (partition by conversation_id order by avg_score desc) as rnk from reliability_avg
),
politico_counts as (
  select conversation_id, uid, sum(n) as n from (
    select cp.conversation_id, cp.requested_by as uid, count(*) as n
    from public.conversation_proposals cp, win w
    where cp.created_at >= w.since and cp.conversation_id in (select conversation_id from visible_convs)
    group by cp.conversation_id, cp.requested_by
    union all
    select gp.conversation_id, gp.created_by as uid, count(*) as n
    from public.group_polls gp, win w
    where gp.created_at >= w.since and gp.conversation_id in (select conversation_id from visible_convs)
    group by gp.conversation_id, gp.created_by
  ) combined
  group by conversation_id, uid
),
politico_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from politico_counts
),
reaction_counts as (
  select msg.conversation_id, msg.sender_id as uid, count(*) as n
  from public.message_reactions mr
  join public.messages msg on msg.id = mr.message_id, win w
  where mr.created_at >= w.since and msg.sender_id is not null and mr.user_id <> msg.sender_id
    and msg.conversation_id in (select conversation_id from visible_convs)
  group by msg.conversation_id, msg.sender_id
),
reaction_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from reaction_counts
),
voice_counts as (
  select m.conversation_id, m.sender_id as uid, count(*) as n
  from public.messages m, win w
  where m.sender_id is not null and m.type = 'audio' and m.created_at >= w.since
    and m.conversation_id in (select conversation_id from visible_convs)
  group by m.conversation_id, m.sender_id
),
voice_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from voice_counts
),
-- "Lo Spiantato" e' uno stato attuale (quote non pagate adesso), niente finestra temporale
debt_counts as (
  select e.conversation_id, es.user_id as uid, count(*) as n
  from public.expense_splits es
  join public.expenses e on e.id = es.expense_id
  where es.paid = false and es.user_id is not null
    and e.conversation_id in (select conversation_id from visible_convs)
  group by e.conversation_id, es.user_id
),
debt_rank as (
  select *, rank() over (partition by conversation_id order by n desc) as rnk from debt_counts
),
-- "Il Soprannominato" non e' legato a un gruppo (i nickname non hanno conversation_id): globale
nickname_counts as (
  select given_to as uid, count(*) as n
  from public.nicknames, win w
  where given_to is not null and created_at >= w.since
  group by given_to
),
nickname_rank as (
  select *, rank() over (order by n desc) as rnk from nickname_counts
)
select 'chiacchierone', r.conversation_id, c.name from msg_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'banchiere', r.conversation_id, c.name from expense_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'organizzatore', r.conversation_id, c.name from event_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'favorito', r.conversation_id, c.name from rating_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'caos', r.conversation_id, c.name from chaos_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'roccia', r.conversation_id, c.name from reliability_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'nottambulo', r.conversation_id, c.name from night_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'paparazzo', r.conversation_id, c.name from media_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'presente', r.conversation_id, c.name from vote_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'politico', r.conversation_id, c.name from politico_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'popolare', r.conversation_id, c.name from reaction_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'vocale', r.conversation_id, c.name from voice_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'spiantato', r.conversation_id, c.name from debt_rank r join public.conversations c on c.id = r.conversation_id where r.uid = p_user_id and r.rnk = 1
union all
select 'soprannominato', null::uuid, null::text from nickname_rank r where r.uid = p_user_id and r.rnk = 1;
$$ language sql stable security definer set search_path to 'public';
