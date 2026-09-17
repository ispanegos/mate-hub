import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { friendlyError } from '../../lib/friendlyError'
import AuthLayout from './AuthLayout'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (err) {
      setError(friendlyError(err, 'Invio non riuscito. Riprova.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Controlla la tua email"
        subtitle="Ti abbiamo inviato un link per reimpostare la password."
        footer={
          <span>
            Torna al <Link to="/login">login</Link>
          </span>
        }
      >
        <div className="alert-success">
          Apri l'email che ti abbiamo inviato e segui il link per scegliere una nuova password.
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Password dimenticata"
      subtitle="Ti mandiamo un link per reimpostarla"
      footer={
        <span>
          Torna al <Link to="/login">login</Link>
        </span>
      }
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        {error && <div className="alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="tu@esempio.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Invio…' : 'Invia link di recupero'}
        </button>
      </form>
    </AuthLayout>
  )
}
