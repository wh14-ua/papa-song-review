import { useEffect, useId, useRef, useState } from 'react'
import { NOTE_PROMPTS } from '../labels'
import { MAX_NOTES_LENGTH } from '../storage/selectionStore'
import type { SelectionStatus } from '../types'

interface NoteEditorProps {
  status: SelectionStatus | undefined
  notes: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama mientras escribe (con pausa) y al cerrar: no hay botón "enviar". */
  onSave: (text: string) => void
}

export function NoteEditor({ status, notes, open, onOpenChange, onSave }: NoteEditorProps) {
  if (!open) {
    return (
      <div className="note">
        {notes && (
          <p className="note__saved">
            <span className="note__saved-label">您的备注：</span>
            {notes}
          </p>
        )}
        <button type="button" className="btn btn--quiet" onClick={() => onOpenChange(true)}>
          📝 {notes ? '修改备注' : '写备注'}
        </button>
      </div>
    )
  }
  return (
    <NoteForm
      initial={notes ?? ''}
      prompt={NOTE_PROMPTS[status ?? 'search_more']}
      onSave={onSave}
      onClose={() => onOpenChange(false)}
    />
  )
}

const AUTOSAVE_DELAY_MS = 700

interface NoteFormProps {
  initial: string
  prompt: string
  onSave: (text: string) => void
  onClose: () => void
}

function NoteForm({ initial, prompt, onSave, onClose }: NoteFormProps) {
  const id = useId()
  const [draft, setDraft] = useState(initial)
  const [savedText, setSavedText] = useState(initial)
  const onSaveRef = useRef(onSave)
  const pendingRef = useRef<string | null>(null)

  useEffect(() => {
    onSaveRef.current = onSave
  })

  // Guardado automático tras una pausa al escribir.
  useEffect(() => {
    if (draft === savedText) return
    const timer = window.setTimeout(() => {
      pendingRef.current = null
      onSaveRef.current(draft)
      setSavedText(draft)
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draft, savedText])

  // Si cambia de canción antes de la pausa, se guarda igualmente.
  useEffect(
    () => () => {
      if (pendingRef.current !== null) onSaveRef.current(pendingRef.current)
    },
    [],
  )

  const close = () => {
    if (pendingRef.current !== null) {
      onSaveRef.current(pendingRef.current)
      pendingRef.current = null
    }
    onClose()
  }

  return (
    <div className="note note--open">
      <label htmlFor={id} className="note__prompt">
        {prompt}
      </label>
      <textarea
        id={id}
        className="note__input"
        value={draft}
        rows={3}
        maxLength={MAX_NOTES_LENGTH}
        onChange={(event) => {
          setDraft(event.target.value)
          pendingRef.current = event.target.value
        }}
      />
      <div className="note__actions">
        <span className="note__status" aria-live="polite">
          {draft.trim() !== '' && draft === savedText ? '✓ 已保存' : ''}
        </span>
        <button type="button" className="btn btn--secondary" onClick={close}>
          写好了
        </button>
      </div>
    </div>
  )
}
