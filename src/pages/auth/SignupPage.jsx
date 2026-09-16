import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import AuthLayout from './AuthLayout'
import PasswordField from '../../components/PasswordField'

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/i

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!USERNAME_RE.test(username)) {
      setError('Username: 3-20 caratteri, lettere numeri . e _')
      return
    }
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
      const data = await signUp({ email, password, username })
      if (data.session) {
        navigate('/', { replace: true })
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError(err.message || 'Registrazione non riuscita. Riprova.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Controlla la tua email"
        subtitle="Ti abbiamo inviato un link di conferma per attivare l'account."
        footer={
          <span>
            Torna al <Link to="/login">login</Link>
          </span>
        }
      >
        <div className="alert-success">
          Conferma l'email che ti abbiamo inviato, poi accedi con le tue credenziali.
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Crea il tuo account"
      subtitle="Entra in Mate HUB e resta in contatto con i tuoi amici"
      footer={
        <span>
          Hai già un account? <Link to="/login">Accedi</Link>
        </span>
      }
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        {error && <div className="alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            className="input"
            placeholder="mario_rossi"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

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

        <PasswordField
          id="password"
          label="Password"
          placeholder="Almeno 6 caratteri"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <PasswordField
          id="confirm-password"
          label="Conferma password"
          placeholder="Ripeti la password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creazione account…' : 'Registrati'}
        </button>
      </form>
    </AuthLayout>
  )
}
