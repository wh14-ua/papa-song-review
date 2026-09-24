import { useSelections } from '../app/contexts'

/**
 * Aviso para papá si el navegador no puede guardar el progreso (p. ej. modo
 * incógnito) y no hay Supabase: al cerrar la web se perdería todo.
 */
export function StorageWarning() {
  const { localAvailable, mode } = useSelections()
  if (localAvailable || mode === 'supabase') return null
  return (
    <p className="storage-warning" role="alert">
      ⚠️ 这个浏览器不能保存进度，关掉网页后会丢失。请不要用无痕模式打开。
    </p>
  )
}
