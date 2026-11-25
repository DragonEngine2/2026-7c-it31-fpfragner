import { beforeEach, describe, expect, it } from 'vitest'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { createApp } from './app'
import { createMemoryStore } from './store'

describe('API', () => {
  let server: ReturnType<typeof createApp>
  let cookie = ''

  beforeEach(async () => {
    server = createApp(
      createMemoryStore([
        { id: 1, title: 'Test', category: 'A', note: '', done: false, rating: 3, createdAt: '2026-01-01T00:00:00.000Z' },
      ]),
    )
    const registration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_user', password: 'passwort123' }),
    })
    cookie = registration.headers.get('set-cookie')?.split(';')[0] ?? ''
  })

  const request = (route: string, init: RequestInit = {}) =>
    server.request(route, {
      ...init,
      headers: { ...init.headers, Cookie: cookie },
    })

  it('health liefert ok', async () => {
    const res = await request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('GET /api/items liefert die Einträge', async () => {
    const res = await request('/api/items')
    const body = (await res.json()) as unknown[]
    expect(body).toHaveLength(1)
  })

  it('POST /api/upload speichert Videos und GET liefert sie mit passendem Typ', async () => {
    const formData = new FormData()
    formData.append('file', new File(['video-inhalt'], 'clip.webm', { type: 'video/webm' }))

    const upload = await request('/api/upload', { method: 'POST', body: formData })
    expect(upload.status).toBe(201)
    const body = (await upload.json()) as { url: string; filename: string }

    try {
      expect(body.url).toBe(`/api/uploads/${body.filename}`)
      const video = await request(body.url)
      expect(video.status).toBe(200)
      expect(video.headers.get('Content-Type')).toBe('video/webm')
      expect(await video.text()).toBe('video-inhalt')

      const partial = await request(body.url, { headers: { Range: 'bytes=0-4' } })
      expect(partial.status).toBe(206)
      expect(partial.headers.get('Content-Range')).toBe('bytes 0-4/12')
      expect(await partial.text()).toBe('video')

      const created = await request('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hochgeladenes Video', note: body.url }),
      })
      expect(created.status).toBe(201)
      const catalog = await request('/api/items')
      expect(await catalog.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: 'Hochgeladenes Video', note: body.url }),
      ]))
    } finally {
      await unlink(path.join(process.cwd(), 'uploads', body.filename))
    }
  })

  it('POST /api/upload lehnt nicht unterstützte Dateiendungen ab', async () => {
    const formData = new FormData()
    formData.append('file', new File(['kein video'], 'datei.txt', { type: 'text/plain' }))

    const response = await request('/api/upload', { method: 'POST', body: formData })
    expect(response.status).toBe(400)
  })

  it('GET /api/uploads liefert für fehlende Videos 404', async () => {
    const response = await request('/api/uploads/00000000-0000-4000-8000-000000000000.mp4')
    expect(response.status).toBe(404)
  })

  it('POST legt einen Eintrag an (201)', async () => {
    const res = await request('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Neu' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: number; title: string }
    expect(body.title).toBe('Neu')
  })

  it('POST mit leerem Titel liefert 400', async () => {
    const res = await request('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH aktualisiert einen Eintrag', async () => {
    const res = await request('/api/items/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: true }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: number; done: boolean }
    expect(body.done).toBe(true)
  })

  it('DELETE eines unbekannten Eintrags liefert 404', async () => {
    const res = await request('/api/items/999', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  it('DELETE eines vorhandenen Eintrags liefert 204', async () => {
    const res = await request('/api/items/1', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('schützt API-Routen ohne Anmeldung mit 401', async () => {
    const unauthenticated = createApp(createMemoryStore())
    const response = await unauthenticated.request('/api/items')
    expect(response.status).toBe(401)
  })

  it('meldet Nutzer mit gültigem Passwort an', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_user', password: 'passwort123' }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })
})
