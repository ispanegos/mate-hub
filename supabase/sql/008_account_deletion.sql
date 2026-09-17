-- Diritto alla cancellazione (GDPR art. 17): elimina l'account e tutti i
-- dati collegati. Molte tabelle hanno gia' ON DELETE CASCADE verso
-- profiles/auth.users (conversation_members.user_id, friends,
-- notifications, push_subscriptions, blocked_users, event_participants,
-- event_ratings, nickname_likes) e vengono ripulite automaticamente.
--
-- Le colonne con NO ACTION vanno gestite a mano prima di eliminare
-- auth.users, altrimenti il DELETE fallisce per violazione di foreign key:
-- - dove la colonna e' opzionale (nullable): si scollega l'identita'
--   (SET NULL) e il contenuto condiviso col gruppo resta (i messaggi
--   restano leggibili dagli altri membri, mostrati come "Utente" invece
--   del nome, coerente col fallback gia' presente in displayNameOf)
-- - dove la colonna e' obbligatoria (voti/richieste/opzioni "personali",
--   non contenuto condiviso): la riga viene eliminata (perdere un voto o
--   un'opzione proposta non danneggia nessuno)

create or replace function public.delete_my_account()
returns void as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.message_reactions where user_id = uid;
  delete from public.conversation_ban_votes where voter_id = uid;
  delete from public.conversation_proposal_votes where voter_id = uid;
  delete from public.conversation_proposal_options where proposed_by = uid;
  delete from public.conversation_ban_requests where requested_by = uid or target_user_id = uid;
  delete from public.conversation_proposals where requested_by = uid;

  update public.messages set sender_id = null where sender_id = uid;
  update public.conversations set created_by = null where created_by = uid;
  update public.events set created_by = null where created_by = uid;
  update public.expenses set created_by = null where created_by = uid;
  update public.expenses set paid_by = null where paid_by = uid;
  update public.expense_splits set user_id = null where user_id = uid;
  update public.media set uploaded_by = null where uploaded_by = uid;
  update public.folders set created_by = null where created_by = uid;
  update public.nicknames set given_by = null where given_by = uid;
  update public.nicknames set given_to = null where given_to = uid;
  update public.conversation_members set invited_by = null where invited_by = uid;

  delete from auth.users where id = uid;
end;
$$ language plpgsql security definer set search_path to 'public';

grant execute on function public.delete_my_account() to authenticated;
