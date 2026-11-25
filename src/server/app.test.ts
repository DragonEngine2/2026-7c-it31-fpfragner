import { describe, expect, it } from 'vitest'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
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

  it('POST /api/upload speichert Videos und GET liefert sie mit passendem Typ', async () => {
    const formData = new FormData()
    formData.append('file', new File(['video-inhalt'], 'clip.webm', { type: 'video/webm' }))

    const upload = await app().request('/api/upload', { method: 'POST', body: formData })
    expect(upload.status).toBe(201)
    const body = (await upload.json()) as { url: string; filename: string }

    try {
      expect(body.url).toBe(`/api/uploads/${body.filename}`)
      const video = await app().request(body.url)
      expect(video.status).toBe(200)
      expect(video.headers.get('Content-Type')).toBe('video/webm')
      expect(await video.text()).toBe('video-inhalt')
    } finally {
      await unlink(path.join(process.cwd(), 'uploads', body.filename))
    }
  })

  it('POST /api/upload lehnt nicht unterstützte Dateiendungen ab', async () => {
    const formData = new FormData()
    formData.append('file', new File(['kein video'], 'datei.txt', { type: 'text/plain' }))

    const response = await app().request('/api/upload', { method: 'POST', body: formData })
    expect(response.status).toBe(400)
  })

  it('GET /api/uploads liefert für fehlende Videos 404', async () => {
    const response = await app().request('/api/uploads/00000000-0000-4000-8000-000000000000.mp4')
    expect(response.status).toBe(404)
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
