import './Avatar.css'

export default function Avatar({ url, label, size = 40, color }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: !url && color ? color : undefined }}
    >
      {url ? (
        <img src={url} alt="" />
      ) : (
        <span className="avatar-fallback" style={{ fontSize: Math.max(11, size * 0.42) }}>
          {(label || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  )
}
