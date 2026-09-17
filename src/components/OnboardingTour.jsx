import { useState } from 'react'
import './OnboardingTour.css'

const STORAGE_KEY = 'mate-hub-onboarded-v1'

const STEPS = [
  {
    emoji: '👋',
    title: 'Benvenuto su Mate HUB',
    text: 'La app per restare in contatto con gli amici: chat, eventi, spese condivise e valutazioni STARS.',
  },
  {
    emoji: '💬',
    title: 'Amici e Gruppi',
    text: 'Nella Home trovi i filtri "Amici" e "Gruppi". Da Amici apri chat 1 a 1 o aggiungi nuove persone col bottone +.',
  },
  {
    emoji: '📅',
    title: 'Eventi e spese',
    text: 'Dentro ogni gruppo puoi creare eventi e dividere le spese, che vengono ripartite automaticamente tra i partecipanti.',
  },
  {
    emoji: '⭐',
    title: 'STARS',
    text: 'Dopo un evento potete valutarvi a vicenda su 6 statistiche. Il tuo profilo mostra la media di tutte le valutazioni ricevute.',
  },
  {
    emoji: '🗳️',
    title: 'Decisioni di gruppo',
    text: 'Cambiare nome/foto o eliminare un gruppo richiede il voto della maggioranza dei membri, non decide una persona sola.',
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
