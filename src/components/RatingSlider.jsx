import './RatingSlider.css'

// 11 evenly spaced dot markers (N/V..10) baked into the track background,
// painted above the fill gradient so they stay visible at every value.
const DOT_LAYERS = Array.from(
  { length: 11 },
  (_, i) => `radial-gradient(circle 2px at ${(i / 10) * 100}% 50%, rgba(31, 41, 55, 0.35) 100%, transparent 100%)`,
).join(', ')

// value: null (N/V) or integer 1-10
export default function RatingSlider({ value, onChange }) {
  const sliderValue = value === null ? 0 : value

  return (
    <div className="rating-slider">
      <span className={`rating-slider-value${value === null ? ' is-nv' : ''}`}>
        {value === null ? 'N/V' : value}
      </span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={sliderValue}
        className="rating-slider-input"
        style={{
          '--rs-pct': `${(sliderValue / 10) * 100}%`,
          backgroundImage: `${DOT_LAYERS}, linear-gradient(to right, var(--accent) var(--rs-pct), var(--glass-border) var(--rs-pct))`,
        }}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(v === 0 ? null : v)
        }}
      />
      <div className="rating-slider-ticks" aria-hidden="true">
        <span>N/V</span>
        <span>10</span>
      </div>
    </div>
  )
}
