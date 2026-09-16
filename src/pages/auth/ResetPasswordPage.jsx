import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import AuthLayout from './AuthLayout'

export default function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri')
      return
    }
    if (password !== confirmPassword) {
      setError('Le password non coincidono')
      return
    }

    setSubmitting(true)
    try {
      await updatePassword(password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Aggiornamento non riuscito. Riprova.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AuthLayout title="Un attimo…">
        <p className="profile-hint">Verifica del link in corso…</p>
      </AuthLayout>
    )
  }

  if (!session) {
    return (
      <AuthLayout
        title="Link non valido"
        subtitle="Il link è scaduto o non è più valido."
        footer={
          <span>
            Torna al <Link to="/login">login</Link>
          </span>
        }
      >
        <Link to="/forgot-password" className="btn btn-primary btn-block">
          Richiedi un nuovo link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Nuova password" subtitle="Scegli la tua nuova password">
      <form className="form-stack" onSubmit={handleSubmit}>
        {error && <div className="alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="password">Nuova password</label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="Almeno 6 caratteri"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="confirm-password">Conferma password</label>
          <input
            id="confirm-password"
            type="password"
            className="input"
            placeholder="Ripeti la password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Salvataggio…' : 'Salva nuova password'}
        </button>
      </form>
    </AuthLayout>
  )
}
