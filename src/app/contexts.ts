import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SupabaseConfig } from '../config'
import type { SelectionStore, StoreSnapshot } from '../storage/selectionStore'

export interface AppServices {
  store: SelectionStore
  sessionId: string
  supabase: SupabaseConfig
}

export const ServicesContext = createContext<AppServices | null>(null)

export function useServices(): AppServices {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('ServicesContext no está disponible')
  return services
}

/** Estado actual de las selecciones (se actualiza al instante en cada acción). */
export function useSelections(): StoreSnapshot {
  const { store } = useServices()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/** Mensaje breve de confirmación ("已保存") que sobrevive al cambio de canción. */
export const ToastContext = createContext<(text: string) => void>(() => {})

export function useToast(): (text: string) => void {
  return useContext(ToastContext)
}
