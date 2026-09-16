const SIZE = 240
const CENTER = SIZE / 2
const MAX_R = SIZE / 2 - 34
const RINGS = [0.2, 0.4, 0.6, 0.8, 1]

function pointAt(index, total, fraction) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const r = MAX_R * fraction
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)]
}

// perStat: [{ key, emoji, label, value }] value is 1-10 or null (N/V)
export default function RadarChart({ perStat }) {
  const total = perStat.length
  const ringPolys = RINGS.map((frac) =>
    perStat.map((_, i) => pointAt(i, total, frac).join(',')).join(' ')
  )
  const axisLines = perStat.map((_, i) => pointAt(i, total, 1))

  const valuePoints = perStat.map((s, i) => {
    const frac = s.value === null ? 0.06 : Math.max(s.value / 10, 0.06)
    return { ...s, pt: pointAt(i, total, frac), rated: s.value !== null }
  })
  const polygonPoints = valuePoints.map((p) => p.pt.join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" className="radar-chart">
      {ringPolys.map((pts, i) => (
        <polygon key={i} points={pts} className="radar-grid-ring" />
      ))}
      {axisLines.map(([x, y], i) => (
        <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} className="radar-axis-line" />
      ))}

      <polygon points={polygonPoints} className="radar-value-polygon" />

      {valuePoints.map((p, i) => (
        <circle
          key={i}
          cx={p.pt[0]}
          cy={p.pt[1]}
          r={p.rated ? 4 : 3}
          className={p.rated ? 'radar-value-dot' : 'radar-value-dot radar-value-dot-nv'}
        />
      ))}

      {perStat.map((s, i) => {
        const [lx, ly] = pointAt(i, total, 1.24)
        const anchor = Math.abs(lx - CENTER) < 6 ? 'middle' : lx > CENTER ? 'start' : 'end'
        return (
          <text key={s.key} x={lx} y={ly} textAnchor={anchor} className="radar-axis-label">
            <tspan>{s.emoji}</tspan>
          </text>
        )
      })}
    </svg>
  )
}
