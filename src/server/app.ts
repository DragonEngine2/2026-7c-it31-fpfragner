import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { Hono } from 'hono'
import { credentialsSchema, itemInput, itemPatch } from '../shared/schemas'
import type { Store, UserStore } from './store'
import { createMemoryUserStore } from './store'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
const SESSION_COOKIE = 'framestream_session'
const VIDEO_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
}

function hashPassword(password: string): string {
  const salt = randomUUID()
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function publicUser(user: { id: number; username: string }) {
  return { id: user.id, username: user.username }
}

// Die App wird als Funktion gebaut, damit Tests sie mit Test-Stores starten können.
export function createApp(store: Store, userStore: UserStore = createMemoryUserStore()) {
  const app = new Hono()
  const sessions = new Map<string, number>()

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.post('/api/auth/register', async (c) => {
    const parsed = credentialsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'Ungültiger Benutzername oder Passwort (mindestens 8 Zeichen)' }, 400)
    }

    if (await userStore.findUserByUsername(parsed.data.username)) {
      return c.json({ error: 'Dieser Benutzername ist bereits vergeben' }, 409)
    }

    const user = await userStore.createUser(parsed.data.username, hashPassword(parsed.data.password))
    const token = randomUUID()
    sessions.set(token, user.id)
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })
    return c.json({ user: publicUser(user) }, 201)
  })

  app.post('/api/auth/login', async (c) => {
    const parsed = credentialsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültiger Benutzername oder Passwort' }, 400)

    const user = await userStore.findUserByUsername(parsed.data.username)
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return c.json({ error: 'Benutzername oder Passwort ist falsch' }, 401)
    }

    const token = randomUUID()
    sessions.set(token, user.id)
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })
    return c.json({ user: publicUser(user) })
  })

  app.post('/api/auth/logout', (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) sessions.delete(token)
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.body(null, 204)
  })

  app.get('/api/auth/me', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    const userId = token ? sessions.get(token) : undefined
    const user = userId === undefined ? undefined : await userStore.findUserById(userId)
    return c.json({ user: user ? publicUser(user) : null })
  })

  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/health' || c.req.path.startsWith('/api/auth/')) {
      await next()
      return
    }

    const token = getCookie(c, SESSION_COOKIE)
    const userId = token ? sessions.get(token) : undefined
    const user = userId === undefined ? undefined : await userStore.findUserById(userId)
    if (!user) return c.json({ error: 'Anmeldung erforderlich' }, 401)
    await next()
  })

  app.get('/api/items', async (c) => c.json(await store.list()))

  app.post('/api/upload', async (c) => {
    const formData = await c.req.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) {
      return c.json({ error: 'Keine Datei übermittelt' }, 400)
    }

    const ext = path.extname(file.name).toLowerCase()
    const expectedType = VIDEO_TYPES[ext]
    if (!expectedType || (file.type && file.type !== expectedType)) {
      return c.json({ error: 'Nur MP4-, WebM-, MOV- und OGG-Videos sind erlaubt' }, 400)
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const filename = `${randomUUID()}${ext}`
    await fs.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()), { flag: 'wx' })
    return c.json({ url: `/api/uploads/${encodeURIComponent(filename)}`, filename }, 201)
  })

  app.get('/api/uploads/:filename', async (c) => {
    const requestedName = c.req.param('filename')
    const safeName = path.basename(requestedName)
    const ext = path.extname(safeName).toLowerCase()
    const mime = VIDEO_TYPES[ext]
    if (safeName !== requestedName || !mime || !/^[a-f0-9-]+\.[a-z0-9]+$/i.test(safeName)) {
      return c.json({ error: 'Datei nicht gefunden' }, 404)
    }

    const filePath = path.join(UPLOAD_DIR, safeName)
    try {
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) return c.json({ error: 'Datei nicht gefunden' }, 404)

      const rangeHeader = c.req.header('range')
      let start = 0
      let end = stat.size - 1
      let status = 200
      if (rangeHeader) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
        if (!range || (!range[1] && !range[2]) || stat.size === 0) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' },
          })
        }

        if (!range[1]) {
          const suffixLength = Number(range[2])
          if (suffixLength <= 0) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' },
            })
          }
          start = Math.max(0, stat.size - suffixLength)
        } else {
          start = Number(range[1])
        }
        end = range[2] && range[1] ? Number(range[2]) : stat.size - 1
        end = Math.min(end, stat.size - 1)
        if (start >= stat.size || start > end) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' },
          })
        }
        status = 206
      }

      const headers = new Headers({
        'Content-Type': mime,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
      })
      if (status === 206) headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      const stream = createReadStream(filePath, status === 206 ? { start, end } : undefined)
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers })
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return c.json({ error: 'Datei nicht gefunden' }, 404)
      }
      throw error
    }
  })

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
