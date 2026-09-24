export interface ToastMessage {
  id: number
  text: string
}

/** Región "polite" siempre presente para que los lectores de pantalla anuncien los mensajes. */
export function Toast({ message }: { message: ToastMessage | null }) {
  return (
    <output className="toast" aria-live="polite">
      {message && (
        <span key={message.id} className="toast__bubble">
          {message.text}
        </span>
      )}
    </output>
  )
}
