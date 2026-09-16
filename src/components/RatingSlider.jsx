import './RatingSlider.css'

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
        style={{ '--rs-pct': `${(sliderValue / 10) * 100}%` }}
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
