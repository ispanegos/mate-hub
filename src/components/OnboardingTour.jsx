import { useEffect, useState } from 'react'
import './OnboardingTour.css'

const STORAGE_KEY = 'mate-hub-onboarded-v3'

const STEPS = [
  {
    emoji: '👋',
    title: 'Benvenuto su Mate HUB',
    subtitle: 'Il posto dove tenere insieme la tua combriccola.',
    text: 'Amici, gruppi, chat, eventi, soldi da recuperare e giudizi non richiesti. Tutto qui dentro — e questo tour lo puoi rivedere quando vuoi da Profilo.',
  },
  {
    emoji: '🧑‍🤝‍🧑',
    title: 'Amici',
    subtitle: 'Prima servono gli amici. Poi iniziano i problemi.',
    text: 'Dal filtro "Amici" in Home tocca il + per cercare e mandare richieste. Se qualcuno ti esaurisce la pazienza, lo blocchi dal suo profilo.',
  },
  {
    emoji: '🏛️',
    title: 'Gruppi, ma democratici',
    subtitle: 'Qui il capo del gruppo non esiste.',
    text: 'Crea un gruppo e invita chi vuoi. Cambiare nome, foto o eliminarlo? Si vota, serve la maggioranza. Uscire invece resta libero, senza chiedere permesso a nessuno.',
  },
  {
    emoji: '💬',
    title: 'Chat al completo',
    subtitle: 'Testo, foto, video, vocali: il pacchetto intero.',
    text: 'Tieni premuto un messaggio per rispondere, inoltrare, reagire, modificarlo o eliminarlo (finisce nel Cestino, recuperabile fino a fine giornata). Con @ menzioni qualcuno anche se ha silenziato il resto.',
  },
  {
    emoji: '📌',
    title: 'Bacheca',
    subtitle: 'Le frasi leggendarie meritano di essere incorniciate.',
    text: 'Pinna un messaggio epico nella Bacheca del gruppo, oppure sigilla una Capsula del tempo: un messaggio che nessuno, nemmeno tu, può leggere prima della data che scegli.',
  },
  {
    emoji: '📊',
    title: 'Sondaggi lampo',
    subtitle: 'Per capire chi è davvero d’accordo.',
    text: 'Crea un sondaggio veloce dalla chat, fino a 6 opzioni, risultati in diretta. Solo chi lo crea può chiuderlo.',
  },
  {
    emoji: '📅',
    title: 'Eventi',
    subtitle: '"Oh, ma quindi sabato che si fa?"',
    text: 'Crea un evento nel gruppo e scopri chi viene davvero. Un promemoria arriva il giorno prima, un altro se dimentichi di votare la pagella dopo.',
  },
  {
    emoji: '⭐',
    title: 'Pagella',
    subtitle: 'Il vero motivo per cui esiste quest’app.',
    text: 'Dopo ogni evento vi votate su 6 statistiche — Vibe, Squadra, Energia, Caos, Affidabilità, Carisma — e il tuo profilo diventa un grafico a ragnatela che racconta chi sei davvero.',
  },
  {
    emoji: '🏅',
    title: 'Badge automatici',
    subtitle: 'Nessuno li assegna a mano, te li guadagni.',
    text: 'Il Chiacchierone, il Banchiere, l’Organizzatore e altri undici — calcolati da soli ogni settimana, per gruppo. Se qualcuno ti supera, semplicemente non li hai più. La prima volta che ne sblocchi uno, partono i coriandoli.',
  },
  {
    emoji: '⛅',
    title: 'Meteo del gruppo',
    subtitle: 'Da "in letargo" a "in fiamme".',
    text: 'Nel pannello info di ogni gruppo trovi un indicatore scherzoso basato su quanto siete attivi nelle ultime 48 ore.',
  },
  {
    emoji: '💸',
    title: 'Spese',
    subtitle: 'Perché "poi ti faccio il bonifico" non vale.',
    text: 'Segna quello che avete speso e Mate HUB fa i conti da solo. Sappiamo chi deve soldi a chi senza aprire Excel dopo tre birre.',
  },
  {
    emoji: '🔔',
    title: 'Notifiche giuste',
    subtitle: 'Avvisi solo per quello che conta.',
    text: 'Niente notifiche per ogni messaggio di gruppo, solo per le chat dirette e le menzioni dirette. Ogni lunedì mattina arriva un recap automatico della settimana in ogni gruppo attivo.',
  },
  {
    emoji: '🙋',
    title: 'Il tuo profilo',
    subtitle: 'Foto, pagella, e un nickname che forse non hai scelto tu.',
    text: 'Gli amici possono proporti soprannomi e votarli. Da qui cambi anche tema, esporti i tuoi dati o rivedi questo tour ogni volta che vuoi.',
  },
]

function hasSeenOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // storage non disponibile (es. modalità privata): niente da fare
  }
}

export default function OnboardingTour({ forceOpen = false, onClose }) {
  const [dismissed, setDismissed] = useState(hasSeenOnboarding())
  const [step, setStep] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dello step quando viene riaperto da fuori
    if (forceOpen) setStep(0)
  }, [forceOpen])

  const visible = forceOpen || !dismissed
  if (!visible) return null

  const close = () => {
    markOnboardingSeen()
    setDismissed(true)
    onClose?.()
  }

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card glass-strong">
        <span className="onboarding-emoji">{current.emoji}</span>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-subtitle">{current.subtitle}</p>
        <p className="onboarding-text">{current.text}</p>

        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot${i === step ? ' is-active' : ''}`} />
          ))}
        </div>
        <span className="onboarding-step-count">
          {step + 1} di {STEPS.length}
        </span>

        <div className="onboarding-actions">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-ghost onboarding-back-btn"
              onClick={() => setStep((s) => s - 1)}
              aria-label="Passo precedente"
            >
              ←
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={close}>
            Salta
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
          >
            {isLast ? 'Inizia' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  )
}
