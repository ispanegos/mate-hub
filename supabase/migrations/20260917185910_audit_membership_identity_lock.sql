-- Audit di fine sessione, parte 2: due varchi piu' seri, entrambi
-- pre-esistenti (non introdotti in questa sessione), trovati controllando
-- ogni policy di UPDATE dello schema.
--
-- 1) conversation_members_update_own permetteva a chiunque di riscrivere il
--    conversation_id della propria riga di membership verso QUALSIASI altra
--    conversazione, autoassegnandosi l'accesso a gruppi privati senza invito
--    ne' amicizia. Le uniche colonne che un update legittimo deve poter
--    toccare sono status/muted/color/last_read_at, mai conversation_id o
--    user_id. Bloccato con un trigger, perche' le policy RLS non possono
--    confrontare il valore vecchio e quello nuovo di una riga.
--
-- 2) friends_update_own permetteva anche a chi MANDA una richiesta di
--    amicizia di auto-accettarla, senza che il destinatario facesse nulla:
--    bastava inserire una richiesta pending e poi aggiornarla subito ad
--    'accepted' con lo stesso account. Ora solo il destinatario (friend_id)
--    puo' far passare una richiesta da pending ad accepted/declined.

create or replace function public.lock_conversation_membership_identity()
returns trigger as $$
begin
  if new.conversation_id <> old.conversation_id or new.user_id <> old.user_id then
    raise exception 'non è consentito spostare una membership su un''altra conversazione o un altro utente';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lock_conversation_membership_identity on public.conversation_members;
create trigger trg_lock_conversation_membership_identity
  before update on public.conversation_members
  for each row execute function public.lock_conversation_membership_identity();

create or replace function public.enforce_friend_response_rules()
returns trigger as $$
begin
  if new.user_id <> old.user_id or new.friend_id <> old.friend_id then
    raise exception 'non è consentito modificare le parti di una richiesta di amicizia esistente';
  end if;
  if old.status = 'pending' and new.status in ('accepted', 'declined') and auth.uid() <> old.friend_id then
    raise exception 'solo il destinatario può accettare o rifiutare una richiesta di amicizia';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_friend_response_rules on public.friends;
create trigger trg_enforce_friend_response_rules
  before update on public.friends
  for each row execute function public.enforce_friend_response_rules();
