-- BUG: il trigger trg_notifications_push_trigger chiamava net.http_post ma
-- l'estensione pg_net non era mai stata abilitata sul progetto. Il trigger
-- falliva con "schema net does not exist", e siccome un errore nel trigger
-- fa fallire l'intera INSERT, OGNI riga in notifications ha fallito da
-- quando il trigger e' stato creato: la campanella non ha mai funzionato.

create extension if not exists pg_net;

-- Si abilita pg_net e in piu' si rende il trigger a prova di errore: un
-- problema nell'invio della push (rete, funzione giu', quota, ecc.) non deve
-- mai piu' poter bloccare l'inserimento della notifica in-app.
create or replace function public.trigger_send_push()
returns trigger as $$
begin
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
  exception when others then
    null;
  end;
  return new;
end;
$$ language plpgsql security definer set search_path to 'public';
