import { Hono } from 'hono'
import { itemInput, itemPatch } from '../shared/schemas'
import type { Store } from './store'

// Die App wird als Funktion gebaut, damit Tests sie mit einem Test-Store starten können.
export function createApp(store: Store) {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/items', async (c) => c.json(await store.list()))

  app.post('/api/items', async (c) => {
    const parsed = itemInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'Ungültige Eingabe', details: parsed.error.issues }, 400)
    }
    const item = await store.create(parsed.data)
    return c.json(item, 201)
  })

  app.patch('/api/items/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const parsed = itemPatch.safeParse(await c.req.json().catch(() => null))
    if (!Number.isInteger(id) || !parsed.success) {
      return c.json({ error: 'Ungültige Eingabe' }, 400)
    }
    const item = await store.update(id, parsed.data)
    return item ? c.json(item) : c.json({ error: 'Nicht gefunden' }, 404)
  })

  app.delete('/api/items/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const removed = await store.remove(id)
    return removed ? c.body(null, 204) : c.json({ error: 'Nicht gefunden' }, 404)
  })

  return app
}
