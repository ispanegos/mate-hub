export const STAT_DEFS = [
  {
    key: 'vibe',
    emoji: '🔥',
    label: 'Vibe',
    description: 'Quanto è piacevole avere questa persona in giro: il mood e l\'atmosfera che porta al gruppo.',
  },
  {
    key: 'team',
    emoji: '🤝',
    label: 'Squadra',
    description: 'Quanto gioca bene di squadra: collabora, include e aiuta gli altri.',
  },
  {
    key: 'energy',
    emoji: '⚡',
    label: 'Energia',
    description: 'Quanta carica ed entusiasmo porta agli eventi e alle attività di gruppo.',
  },
  {
    key: 'chaos',
    emoji: '🌪️',
    label: 'Caos',
    description: 'Quanto genera imprevisti, casino e situazioni fuori controllo (in senso divertente).',
  },
  {
    key: 'reliability',
    emoji: '🎯',
    label: 'Affidabilità',
    description: 'Quanto ci si può contare su di lei/lui: puntualità e impegni mantenuti.',
  },
  {
    key: 'charisma',
    emoji: '✨',
    label: 'Carisma',
    description: 'Quanto attira e coinvolge gli altri con la propria presenza.',
  },
]

export function formatStatValue(value) {
  if (value === null || value === undefined) return 'N/V'
  return value.toFixed(1)
}

// stats: array of { stat_key, avg_score, votes } from get_user_stats RPC
export function buildStarsProfile(stats) {
  const byKey = {}
  for (const row of stats || []) {
    byKey[row.stat_key] = { value: Number(row.avg_score), votes: Number(row.votes) }
  }

  const perStat = STAT_DEFS.map((def) => {
    const entry = byKey[def.key]
    return {
      ...def,
      value: entry ? entry.value : null,
      votes: entry ? entry.votes : 0,
    }
  })

  const rated = perStat.filter((s) => s.value !== null)
  const overall = rated.length ? rated.reduce((sum, s) => sum + s.value, 0) / rated.length : null

  return { perStat, overall, ratedCount: rated.length }
}

// Selects a question id for a stat, avoiding the voter's most recently seen questions.
export function pickQuestion(questions, recentQuestionIds) {
  const pool = questions.filter((q) => !recentQuestionIds.includes(q.id))
  const source = pool.length ? pool : questions
  return source[Math.floor(Math.random() * source.length)]
}
