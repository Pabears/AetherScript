// ============================================================
// Fleet Commander — HTTP Server Entry Point
// Port: 3721
// ============================================================

import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { handleApi } from './api.ts'

const PORT = 3721
const UI_DIR = join(import.meta.dir, '..', 'ui')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function getMime(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'))
  return MIME_TYPES[ext] ?? 'text/plain'
}

function serveStatic(filePath: string): Response | null {
  if (!existsSync(filePath)) return null
  const content = readFileSync(filePath)
  const mime = getMime(filePath)
  return new Response(content, {
    headers: { 'Content-Type': mime },
  })
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname

    // CORS headers for local dev
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // ── API routes ─────────────────────────────────────────
    if (pathname.startsWith('/api/')) {
      const res = await handleApi(req, url)
      // Attach CORS headers
      const newHeaders = new Headers(res.headers)
      for (const [k, v] of Object.entries(corsHeaders)) {
        newHeaders.set(k, v)
      }
      return new Response(res.body, {
        status: res.status,
        headers: newHeaders,
      })
    }

    // ── Static UI files ────────────────────────────────────
    if (pathname !== '/' && pathname !== '/index.html') {
      const filePath = join(UI_DIR, pathname)
      const staticRes = serveStatic(filePath)
      if (staticRes) return staticRes
    }

    // ── SPA fallback → index.html ──────────────────────────
    const indexPath = join(UI_DIR, 'index.html')
    const indexRes = serveStatic(indexPath)
    if (indexRes) return indexRes

    return new Response('Fleet Commander: UI not found', { status: 404 })
  },
})

console.log(`
╔══════════════════════════════════════════════╗
║   🚀  Fleet Commander — 舰队指挥中心          ║
║   Listening on http://localhost:${PORT}       ║
╚══════════════════════════════════════════════╝
`)
