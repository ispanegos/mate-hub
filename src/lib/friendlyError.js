const PATTERNS = [
  { test: /duplicate key value violates unique constraint "profiles_username_key"/i, message: 'Questo username è già in uso.' },
  { test: /duplicate key value violates unique constraint "blocked_users_pkey"/i, message: 'Hai già bloccato questo utente.' },
  { test: /duplicate key value violates unique constraint/i, message: 'Questo elemento esiste già.' },
  { test: /new row violates row-level security policy/i, message: 'Non hai i permessi per completare questa azione.' },
  { test: /violates foreign key constraint/i, message: 'Elemento collegato non trovato.' },
  { test: /Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/i, message: 'Connessione assente. Controlla la rete e riprova.' },
  { test: /Invalid login credentials/i, message: 'Email o password non corrette.' },
  { test: /User already registered/i, message: 'Esiste già un account con questa email.' },
  { test: /Email not confirmed/i, message: 'Conferma prima la tua email.' },
  { test: /Password should be at least/i, message: 'La password è troppo corta.' },
]

export function friendlyError(err, fallback = 'Qualcosa è andato storto. Riprova.') {
  const raw = typeof err === 'string' ? err : err?.message
  if (!raw) return fallback
  const match = PATTERNS.find((p) => p.test.test(raw))
  return match ? match.message : raw
}
