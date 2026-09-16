import { useTheme } from '../context/useTheme'
import './ThemeToggle.css'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle glass"
      onClick={toggleTheme}
      aria-label={isDark ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
      title={isDark ? 'Tema chiaro' : 'Tema scuro'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            fill="currentColor"
            d="M20.7 14.9a8.6 8.6 0 0 1-10.6-10.6.7.7 0 0 0-.9-.9A9.9 9.9 0 1 0 21.6 15.8a.7.7 0 0 0-.9-.9Z"
          />
        </svg>
      )}
    </button>
  )
}
