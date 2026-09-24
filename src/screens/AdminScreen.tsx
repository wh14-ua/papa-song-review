import { useMemo, useState } from 'react'
import { useSelections, useServices } from '../app/contexts'
import { Link } from '../components/Link'
import { buildExportRows, toCsv, toJson } from '../data/export'
import { computeStats } from '../data/progress'
import { downloadText } from '../lib/download'
import type { SyncPhase } from '../storage/selectionStore'
import type { ReviewCatalog } from '../types'

const PHASE_TEXT: Record<SyncPhase, string> = {
  'local-only': 'Solo en este navegador (localStorage)',
  syncing: 'Sincronizando…',
  synced: 'Sincronizado con Supabase',
  error: 'Error de sincronización: se reintentará automáticamente',
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('es-ES') : '—'
}

function ConfigNotice() {
  const { supabase } = useServices()
  switch (supabase.status) {
    case 'ok':
      return null
    case 'missing':
      return (
        <p className="admin-note">
          Supabase no está configurado: el progreso se guarda solo en el navegador donde se usa la web. Añade{' '}
          <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> y vuelve a desplegar; lo guardado
          en local se subirá solo.
        </p>
      )
    case 'incomplete':
      return (
        <p className="admin-note admin-note--warn">
          Falta una de las dos variables (<code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>). Se
          usa solo localStorage.
        </p>
      )
    case 'invalid-url':
      return (
        <p className="admin-note admin-note--warn">
          <code>VITE_SUPABASE_URL</code> no es una URL https válida. Se usa solo localStorage.
        </p>
      )
    case 'forbidden-key':
      return (
        <p className="admin-note admin-note--danger" role="alert">
          La clave configurada es una <strong>service_role / secret key</strong> y NO se ha usado. Esa clave ya está
          dentro del JavaScript publicado: rótala en Supabase y usa la anon (o publishable) key.
        </p>
      )
  }
}

export function AdminScreen({ catalog }: { catalog: ReviewCatalog }) {
  const { store, sessionId, supabase } = useServices()
  const snapshot = useSelections()
  const [includeDuplicates, setIncludeDuplicates] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const stats = useMemo(() => computeStats(catalog.songs, snapshot.records), [catalog, snapshot.records])
  const rows = useMemo(
    () => buildExportRows(catalog, snapshot.records, { includeDuplicates }),
    [catalog, snapshot.records, includeDuplicates],
  )
  const duplicateCount = catalog.totalEntries - catalog.songs.length
  const countOk = catalog.songs.length === catalog.expectedUniqueSongs

  const fileBase = () => `seleccion-${sessionId}-${new Date().toISOString().slice(0, 10)}${includeDuplicates ? '-con-duplicados' : ''}`

  const syncNow = async () => {
    setSyncing(true)
    try {
      await store.syncNow()
    } finally {
      setSyncing(false)
    }
  }

  const summary: [string, number][] = [
    ['Total', stats.total],
    ['Selected', stats.selected],
    ['None', stats.none],
    ['Wrong song', stats.wrong_song],
    ['Search more', stats.search_more],
    ['Skipped', stats.skipped],
    ['Pending', stats.untouched],
  ]

  return (
    <div className="screen screen--admin" lang="es">
      <header className="mini-cover">
        <div className="mini-cover__inner">
          <Link to={{ name: 'home' }} className="cover__home">
            ← Web de papá
          </Link>
          <h1 className="mini-cover__title">Administración</h1>
        </div>
      </header>

      <main className="page page--wide">
        <section className="panel">
          <h2 className="section-title">Estado</h2>
          <dl className="admin-dl">
            <dt>Sesión</dt>
            <dd>
              <code>{sessionId}</code> <span className="muted">(cambiar con ?session=… o VITE_REVIEW_SESSION_ID)</span>
            </dd>
            <dt>Guardado</dt>
            <dd>{PHASE_TEXT[snapshot.phase]}</dd>
            {supabase.status === 'ok' && (
              <>
                <dt>Supabase</dt>
                <dd>
                  <code>{new URL(supabase.settings.url).host}</code>
                </dd>
                <dt>Última sincronización</dt>
                <dd>{formatDate(snapshot.lastSyncedAt)}</dd>
              </>
            )}
            <dt>Pendientes de subir</dt>
            <dd>{snapshot.mode === 'supabase' ? snapshot.pendingCount : `${snapshot.pendingCount} (se subirán al configurar Supabase)`}</dd>
            <dt>localStorage</dt>
            <dd>{snapshot.localAvailable ? 'disponible' : 'NO disponible en este navegador'}</dd>
          </dl>
          {snapshot.lastError && (
            <p className="admin-note admin-note--warn">
              Último error: <code>{snapshot.lastError}</code>
            </p>
          )}
          <ConfigNotice />
          {snapshot.mode === 'supabase' && (
            <button type="button" className="btn btn--secondary" onClick={() => void syncNow()} disabled={syncing}>
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title">Dataset</h2>
          <p>
            <code>songs.json</code>: {catalog.totalEntries} registros, {duplicateCount} duplicados (heredan la elección
            de su canónico) y <strong>{catalog.songs.length}</strong> canciones únicas a revisar{' '}
            {countOk ? '✓' : <strong className="danger">⚠️ se esperaban {catalog.expectedUniqueSongs}</strong>}
          </p>
        </section>

        <section className="panel">
          <h2 className="section-title">Resumen</h2>
          <table className="admin-table admin-table--summary">
            <tbody>
              {summary.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Progreso</th>
                <td>
                  {stats.done} / {stats.total} ({stats.percent} %)
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted">Pending = sin ninguna acción todavía. Skipped = saltadas («暂时跳过»).</p>
        </section>

        <section className="panel">
          <h2 className="section-title">Exportar</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeDuplicates}
              onChange={(event) => setIncludeDuplicates(event.target.checked)}
            />
            <span>
              Incluir también los {duplicateCount} duplicados ({catalog.totalEntries} filas; cada uno hereda la elección
              de su registro canónico)
            </span>
          </label>
          <div className="button-row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => downloadText(`${fileBase()}.json`, toJson(rows), 'application/json')}
            >
              Descargar JSON
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => downloadText(`${fileBase()}.csv`, toCsv(rows), 'text/csv')}
            >
              Descargar CSV
            </button>
          </div>
          <p className="muted">
            {rows.length} filas · {rows.filter((r) => r.video_ids.length > 0).length} con al menos un vídeo elegido ·{' '}
            {rows.reduce((total, row) => total + row.video_ids.length, 0)} vídeos elegidos en total. Los campos
            video_id/youtube_url conservan la primera elección; video_ids/youtube_urls contienen todas.
          </p>
        </section>

        <section className="panel">
          <h2 className="section-title">Canciones</h2>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Canción</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Vídeo</th>
                  <th scope="col">Notas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.song_id} className={row.duplicate_of ? 'is-duplicate' : undefined}>
                    <td>
                      <Link to={{ name: 'song', songId: row.duplicate_of ?? row.song_id }}>{row.song_id}</Link>
                      {row.duplicate_of && <span className="muted"> → {row.duplicate_of}</span>}
                    </td>
                    <td lang="zh-CN">
                      {row.title ?? '—'}
                      {row.artist && <span className="muted"> · {row.artist}</span>}
                      <br />
                      <span className="muted">「{row.source_text}」</span>
                    </td>
                    <td>
                      <span className={`status-pill status-pill--${row.status}`}>{row.status}</span>
                    </td>
                    <td>
                      {row.youtube_urls.length > 0 ? (
                        <span className="admin-video-links">
                          {row.youtube_urls.map((url, index) => (
                            <span key={row.video_ids[index] ?? url}>
                              {index > 0 && ' · '}
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                {row.video_ids[index] ?? `vídeo ${index + 1}`}
                              </a>
                            </span>
                          ))}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td lang="zh-CN">{row.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
