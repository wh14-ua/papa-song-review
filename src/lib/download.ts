/** Descarga un texto como archivo (sin servidor). */
export function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Safari necesita que la URL siga viva un momento después del click.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
