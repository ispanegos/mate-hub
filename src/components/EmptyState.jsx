import './EmptyState.css'

export default function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state glass">
      <div className="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
          <path
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 5.5h16v10H9l-4 3.5v-3.5H4v-10Z"
          />
        </svg>
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
