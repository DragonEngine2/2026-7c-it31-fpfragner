import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app'
import { createDatabase } from './db'
import { createSqliteStore } from './store.sqlite'

const db = await createDatabase()
const store = createSqliteStore(db)

const app = createApp(store, store)

// Im Entwicklungsmodus nicht-API Anfragen an Vite (5173) weiterleiten
app.all('*', async (c, next) => {
  try {
    const url = new URL(c.req.url)
    const target = `http://localhost:5173${url.pathname}${url.search}`
    const res = await fetch(target, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.raw.arrayBuffer(),
    })
    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
    })
  } catch {
    await next()
  }
})

// Im Container liefert das Backend auch das gebaute Frontend aus (npm run build).
if (existsSync('dist/client/index.html')) {
  app.use('/*', serveStatic({ root: './dist/client' }))
  app.get('*', serveStatic({ path: './dist/client/index.html' }))
}

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server läuft auf http://localhost:${port}`)
})
