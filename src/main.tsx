import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { readSupabaseConfig, resolveBrowserSessionId } from './config'
import { browserStorage, createLocalPersistence } from './storage/localPersistence'
import { SelectionStore } from './storage/selectionStore'
import { createSupabaseGateway } from './storage/supabaseGateway'
import './styles/index.css'

const sessionId = resolveBrowserSessionId()
const supabase = readSupabaseConfig(import.meta.env)

if (supabase.status === 'forbidden-key') {
  console.error(
    '[cancionero] VITE_SUPABASE_ANON_KEY contiene una service_role/secret key: no se usa. Pon la anon/publishable key y rota la clave.',
  )
}

const store = new SelectionStore({
  sessionId,
  local: createLocalPersistence(browserStorage(), sessionId),
  remote: supabase.status === 'ok' ? createSupabaseGateway(supabase.settings) : null,
})
void store.start()

// Reintentar en cuanto vuelva la conexión o papá vuelva a la pestaña.
window.addEventListener('online', () => void store.syncNow())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void store.syncNow()
})

const root = document.getElementById('root')
if (!root) throw new Error('#root no existe en index.html')

createRoot(root).render(
  <StrictMode>
    <App services={{ store, sessionId, supabase }} />
  </StrictMode>,
)
