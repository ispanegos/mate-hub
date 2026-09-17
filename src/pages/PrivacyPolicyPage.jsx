import { Link } from 'react-router-dom'
import './PrivacyPolicyPage.css'

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-card glass-strong">
        <Link to="/" className="btn btn-ghost privacy-back">
          ← Torna a Mate HUB
        </Link>

        <h1>Informativa sulla privacy</h1>
        <p className="privacy-updated">Ultimo aggiornamento: da personalizzare prima della pubblicazione.</p>

        <p className="privacy-disclaimer">
          Questa pagina descrive in modo tecnico e trasparente come Mate HUB tratta i dati. Non sostituisce una
          consulenza legale: prima di condividere questo testo con gli utenti, fallo rivedere da chi gestisce
          l'app (anche solo per inserire i propri dati di contatto).
        </p>

        <h2>Chi gestisce l'app</h2>
        <p>
          Mate HUB è un progetto gestito da un piccolo gruppo di amici/sviluppatori. Per qualsiasi richiesta sui
          tuoi dati (accesso, correzione, cancellazione) scrivi a chi ti ha invitato nell'app o al contatto
          indicato nel gruppo principale.
        </p>

        <h2>Che dati raccogliamo</h2>
        <ul>
          <li>Email e password (gestite da Supabase Auth, la password non è mai visibile a nessuno in chiaro)</li>
          <li>Username, nome e cognome (facoltativi), foto profilo</li>
          <li>Messaggi, foto, video e audio che invii nelle chat</li>
          <li>Eventi e spese che crei o a cui partecipi, voti della pagella dati e ricevuti</li>
          <li>Se attivi le notifiche push: un identificativo tecnico del tuo browser/dispositivo, non il tuo nome</li>
        </ul>

        <h2>Perché li usiamo</h2>
        <p>
          Solo per far funzionare l'app: farti accedere, farti chattare con i tuoi amici, organizzare eventi e
          spese di gruppo, calcolare la tua pagella, mandarti notifiche sulle cose che ti riguardano.
          Non vendiamo né condividiamo i tuoi dati con nessuno a scopo pubblicitario. Non c'è tracciamento
          pubblicitario di nessun tipo.
        </p>

        <h2>Con chi condividiamo i dati</h2>
        <p>Per far funzionare l'app ci appoggiamo a questi fornitori, che agiscono come responsabili del trattamento:</p>
        <ul>
          <li><strong>Supabase</strong> — database, autenticazione e archiviazione di foto/video/audio</li>
          <li><strong>Vercel</strong> — hosting del sito</li>
          <li>
            <strong>Google, Apple, Mozilla</strong> — solo se attivi le notifiche push, per recapitarle al tuo
            browser (nessun contenuto del messaggio resta memorizzato da loro dopo la consegna)
          </li>
        </ul>

        <h2>I tuoi diritti</h2>
        <ul>
          <li>
            <strong>Accesso e portabilità</strong> — dalla pagina Profilo puoi scaricare in qualsiasi momento una
            copia di tutti i tuoi dati in formato leggibile (JSON)
          </li>
          <li>
            <strong>Cancellazione</strong> — dalla pagina Profilo puoi eliminare definitivamente il tuo account e
            tutti i dati collegati; i messaggi che hai scritto in chat di gruppo restano visibili agli altri
            membri ma senza il tuo nome (come "Utente"), per non cancellare la conversazione altrui
          </li>
          <li><strong>Rettifica</strong> — puoi modificare nome, cognome e foto in qualsiasi momento dal Profilo</li>
          <li>
            <strong>Blocco</strong> — puoi bloccare un altro utente in qualsiasi momento dalla sua pagina profilo,
            impedendogli di mandarti nuove richieste di amicizia o inviti
          </li>
        </ul>

        <h2>Quanto conserviamo i dati</h2>
        <p>
          Finché il tuo account esiste. I messaggi che elimini finiscono in un cestino personale e vengono
          rimossi automaticamente a fine giornata. Se elimini l'account, tutto quello che è solo tuo (richieste
          di amicizia, notifiche, foto profilo, dispositivi per le notifiche) viene cancellato subito; i
          contenuti condivisi con un gruppo (messaggi, eventi, spese) restano ma senza più alcun collegamento con
          la tua identità.
        </p>

        <h2>Sicurezza</h2>
        <p>
          Ogni tabella del database ha regole di accesso (Row Level Security) che permettono a ciascun utente di
          vedere solo i propri dati e quelli delle conversazioni di cui fa parte. Le password sono gestite
          interamente da Supabase Auth con hashing sicuro.
        </p>

        <h2>Età minima</h2>
        <p>Mate HUB non è pensata per persone sotto i 14 anni.</p>
      </div>
    </div>
  )
}
