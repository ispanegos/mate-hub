import { useState } from 'react'
import './OnboardingTour.css'

const STORAGE_KEY = 'mate-hub-onboarded-v2'

const STEPS = [
  {
    emoji: '👋',
    title: 'Benvenuto su Mate HUB',
    subtitle: 'Il posto dove tenere insieme la tua combriccola.',
    text: 'Amici, gruppi, chat, serate, soldi da recuperare e giudizi non richiesti. Tutto qui dentro.',
  },
  {
    emoji: '💬',
    title: 'Amici e gruppi',
    subtitle: 'Prima servono gli amici. Poi iniziano i problemi.',
    text: 'Aggiungi la tua gente, crea i gruppi e scrivetevi in chat. Il + fa praticamente tutto il lavoro sporco.',
  },
  {
    emoji: '📅',
    title: 'Eventi',
    subtitle: '"Oh, ma quindi sabato che si fa?"',
    text: 'Crea un evento nel gruppo, invita chi vuoi e scopri finalmente chi viene, chi forse e chi visualizza e sparisce.',
  },
  {
    emoji: '💸',
    title: 'Spese',
    subtitle: 'Perché "poi ti faccio il bonifico" non vale.',
    text: 'Segna quello che avete speso e Mate HUB fa i conti. Così sappiamo chi deve soldi a chi senza aprire Excel dopo tre birre.',
  },
  {
    emoji: '⭐',
    title: 'Pagelle',
    subtitle: 'Dopo ogni evento arriva il momento di giudicarsi.',
    text: 'Votatevi su 6 statistiche e costruite la vostra pagella. Più partecipi, più il tuo profilo racconta che razza di elemento sei.',
  },
  {
    emoji: '🗳️',
    title: 'Democrazia, purtroppo',
    subtitle: 'Qui il capo del gruppo non esiste.',
    text: 'Nome, foto o addirittura eliminare il gruppo? Si vota. Decide la maggioranza, quindi preparati anche a perdere malissimo.',
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

export default function OnboardingTour() {
  const [dismissed, setDismissed] = useState(hasSeenOnboarding())
  const [step, setStep] = useState(0)

  if (dismissed) return null

  const close = () => {
    markOnboardingSeen()
    setDismissed(true)
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

        <div className="onboarding-actions">
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
