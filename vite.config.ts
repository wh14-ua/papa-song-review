import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * GitHub Pages no tiene "SPA fallback": si alguien abre /admin directamente
 * devuelve 404. Copiar index.html como 404.html hace que la app arranque igual.
 * Solo se activa con GITHUB_PAGES=true (Cloudflare Pages ya hace el fallback
 * por sí mismo mientras NO exista un 404.html, y Vercel usa vercel.json).
 */
function githubPagesSpaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      if (process.env.GITHUB_PAGES !== 'true') return
      const index = resolve(outDir, 'index.html')
      if (existsSync(index)) copyFileSync(index, resolve(outDir, '404.html'))
    },
  }
}

// BASE_PATH permite publicar en un subdirectorio (p. ej. GitHub Pages: /nombre-del-repo/).
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), githubPagesSpaFallback()],
  build: {
    target: 'es2020',
  },
})
