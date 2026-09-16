import './LoadingScreen.css'

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-card glass">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Caricamento…</p>
      </div>
    </div>
  )
}
