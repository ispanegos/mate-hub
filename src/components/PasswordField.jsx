import { useState } from 'react'
import './PasswordField.css'

function EyeIcon({ off }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
        <path
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.5 3.5l17 17M10.6 10.7a2.5 2.5 0 0 0 3.5 3.5M7.4 7.5C5 9 3.3 11 2.5 12c1.6 2.7 5 6.5 9.5 6.5 1.6 0 3-.4 4.3-1.1M16.9 16.9c2-1.4 3.5-3.2 4.6-4.9-1.6-2.7-5-6.5-9.5-6.5-1 0-2 .2-2.9.5"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12c1.6-2.7 5-6.5 9.5-6.5s7.9 3.8 9.5 6.5c-1.6 2.7-5 6.5-9.5 6.5S4.1 14.7 2.5 12Z"
      />
      <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export default function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  required,
  value,
  onChange,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="input password-field-input"
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="password-field-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Nascondi password' : 'Mostra password'}
          tabIndex={-1}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    </div>
  )
}
