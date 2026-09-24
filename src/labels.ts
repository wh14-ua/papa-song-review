import type { SelectionStatus } from './types'

/** Textos que ve papá: chino simplificado, con subtítulo en español. */
export const STATUS_LABELS: Record<SelectionStatus, { icon: string; zh: string; es: string }> = {
  selected: { icon: '✅', zh: '已选好', es: 'Elegida' },
  none: { icon: '❌', zh: '都不是', es: 'Ninguna de estas versiones' },
  search_more: { icon: '🔎', zh: '再找找', es: 'Buscar más' },
  wrong_song: { icon: '❓', zh: '不是这首歌', es: 'No es esta canción' },
  skipped: { icon: '⏭️', zh: '暂时跳过', es: 'Saltar por ahora' },
}

/** Orden de los botones alternativos (cuadrícula 2×2). */
export const OTHER_STATUSES = ['none', 'search_more', 'wrong_song', 'skipped'] as const

/** Qué se le pregunta en la nota según lo que eligió. */
export const NOTE_PROMPTS: Record<SelectionStatus, string> = {
  selected: '想补充什么吗？（可以不写）',
  none: '您想要什么样的版本？可以写下来（可以不写）',
  search_more: '要找哪一首、谁唱的？可以写下来（可以不写）',
  wrong_song: '您想的是哪首歌？歌名、歌手或一句歌词都可以（可以不写）',
  skipped: '想补充什么吗？（可以不写）',
}

const TYPE_LABELS: Record<string, string> = {
  official_mv: '官方MV',
  studio: '录音室版',
  topic: '官方音频',
  live: '现场版',
  cover: '翻唱',
  other: '其他版本',
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? '其他版本'
}

/** Solo se señala el idioma cuando no es mandarín. */
const LANGUAGE_LABELS: Record<string, string> = {
  粤语: '粤语',
  英语: '英文歌',
  instrumental: '纯音乐',
}

export function languageLabel(language: string | null): string | null {
  return language ? (LANGUAGE_LABELS[language] ?? null) : null
}

export function yearLabel(year: number | null): string | null {
  return year ? `${year}年` : null
}

/**
 * De manual_review_question_zh ("您写的「X」是下面哪一首？请听一听再选：A. … / 都不是")
 * se muestra solo la pregunta; las opciones ya aparecen como grupos A, B, C…
 */
export function questionLead(question: string): string {
  const optionsStart = question.search(/[：:]\s*A\.\s/)
  if (optionsStart === -1) return question
  const lead = question.slice(0, optionsStart)
  const afterQuote = lead.lastIndexOf('」')
  return afterQuote === -1 ? lead : lead.slice(afterQuote + 1)
}
