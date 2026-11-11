import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createMemoryStore } from './store'

describe('API', () => {
  const app = () =>
    createApp(
      createMemoryStore([
        { id: 1, title: 'Test', category: 'A', note: '', done: false, createdAt: '2026-01-01T00:00:00.000Z' },
      ]),
    )

  it('health liefert ok', async () => {
    const res = await app().request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('GET /api/items liefert die Einträge', async () => {
    const res = await app().request('/api/items')
    const body = (await res.json()) as unknown[]
    expect(body).toHaveLength(1)
  })

  it('POST legt einen Eintrag an (201)', async () => {
    const res = await app().request('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Neu' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: number; title: string }
    expect(body.title).toBe('Neu')
  })

  it('POST mit leerem Titel liefert 400', async () => {
    const res = await app().request('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH aktualisiert einen Eintrag', async () => {
    const res = await app().request('/api/items/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: true }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: number; done: boolean }
    expect(body.done).toBe(true)
  })

  it('DELETE eines unbekannten Eintrags liefert 404', async () => {
    const res = await app().request('/api/items/999', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  it('DELETE eines vorhandenen Eintrags liefert 204', async () => {
    const res = await app().request('/api/items/1', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })
})
