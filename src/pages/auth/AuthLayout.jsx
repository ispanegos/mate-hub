import ThemeToggle from '../../components/ThemeToggle'
import './AuthLayout.css'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-layout">
      <div className="auth-topbar">
        <div className="auth-brand">
          <span className="auth-brand-mark">MH</span>
          <span className="auth-brand-name">Mate HUB</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="auth-center">
        <div className="auth-card glass-strong">
          <div className="auth-card-head">
            <h1>{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
