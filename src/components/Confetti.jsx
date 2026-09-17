import { useEffect, useState } from 'react'
import './Confetti.css'

const COLORS = ['#ff5c5c', '#ffb100', '#4caf50', '#2196f3', '#9c27b0', '#ff69b4']

function makePieces() {
  return Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1.3 + Math.random() * 0.7,
    color: COLORS[i % COLORS.length],
    rotate: Math.random() * 360,
  }))
}

export default function Confetti({ active, onDone }) {
  const [pieces, setPieces] = useState([])

  useEffect(() => {
    if (!active) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- new random burst each time a celebration starts
    setPieces(makePieces())
    const t = setTimeout(() => onDone?.(), 2000)
    return () => clearTimeout(t)
  }, [active, onDone])

  if (!active) return null

  return (
    <div className="confetti-overlay" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}
