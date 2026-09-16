import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import AuthLayout from './AuthLayout'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn({ email, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Accesso non riuscito. Riprova.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Bentornato"
      subtitle="Accedi per continuare le tue conversazioni"
      footer={
        <span>
          Non hai un account? <Link to="/signup">Registrati</Link>
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

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Accesso in corso…' : 'Accedi'}
        </button>
      </form>
    </AuthLayout>
  )
}
