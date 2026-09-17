-- Audit di fine sessione: le policy di UPDATE su voti/sondaggi controllavano
-- solo "sei tu il proprietario della riga" e "il bersaglio è ancora aperto",
-- ma non ricontrollavano l'appartenenza al gruppo sul valore NUOVO della riga.
-- Un utente con un proprio voto/sondaggio già esistente poteva quindi
-- riscrivere quella riga (poll_id/proposal_id/request_id/conversation_id)
-- per puntare a un sondaggio, una proposta o una richiesta di ban di un
-- gruppo a cui NON appartiene, votando o chiudendo cose che non dovrebbe
-- nemmeno vedere. Non e' mai stato sfruttato (trovato in audit, non da un
-- incidente), ma va chiuso: ogni UPDATE ora ricontrolla l'appartenenza al
-- gruppo sul valore che la riga avrebbe DOPO la modifica.

drop policy if exists "group_polls_update_own" on public.group_polls;
create policy "group_polls_update_own" on public.group_polls
  for update using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = group_polls.conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "group_poll_votes_update_own" on public.group_poll_votes;
create policy "group_poll_votes_update_own" on public.group_poll_votes
  for update using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.group_polls p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = group_poll_votes.poll_id and p.status = 'open'
        and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "proposal_votes_update_own" on public.conversation_proposal_votes;
create policy "proposal_votes_update_own" on public.conversation_proposal_votes
  for update using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.conversation_proposals p
      join public.conversation_members cm on cm.conversation_id = p.conversation_id
      where p.id = conversation_proposal_votes.proposal_id and p.status = 'open'
        and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

drop policy if exists "ban_votes_update_own" on public.conversation_ban_votes;
create policy "ban_votes_update_own" on public.conversation_ban_votes
  for update using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.conversation_ban_requests r
      join public.conversation_members cm on cm.conversation_id = r.conversation_id
      where r.id = conversation_ban_votes.request_id and r.status = 'open' and r.target_user_id <> auth.uid()
        and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

-- message_pins: l'insert non verificava che message_id appartenesse davvero
-- a conversation_id. Non e' una fuga di contenuti (la select su messages
-- resta comunque ristretta ai membri di quella conversazione), ma permetteva
-- di pinnare un id di messaggio a caso, anche di un'altra conversazione.
drop policy if exists "message_pins_insert_member" on public.message_pins;
create policy "message_pins_insert_member" on public.message_pins
  for insert with check (
    pinned_by = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = message_pins.conversation_id and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
    and exists (
      select 1 from public.messages m
      where m.id = message_pins.message_id and m.conversation_id = message_pins.conversation_id
    )
  );
