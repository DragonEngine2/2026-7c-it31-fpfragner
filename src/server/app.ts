import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { itemInput, itemPatch } from '../shared/schemas'
import type { Store } from './store'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
const VIDEO_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
}

// Die App wird als Funktion gebaut, damit Tests sie mit einem Test-Store starten können.
export function createApp(store: Store) {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/items', async (c) => c.json(await store.list()))

  // Video hochladen und sicher unter einem generierten Namen speichern
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
    const targetPath = path.join(UPLOAD_DIR, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(targetPath, buffer)

    return c.json({ url: `/api/uploads/${encodeURIComponent(filename)}`, filename }, 201)
  })

  // Hochgeladene Videos vom Server ausliefern (inkl. HTTP Range für Scrubbing)
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
      if (!stat.isFile()) {
        return c.json({ error: 'Datei nicht gefunden' }, 404)
      }

      const fileBuffer = await fs.readFile(filePath)
      const rangeHeader = c.req.header('range')

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = Number(match[1])
          const end = match[2] ? Number(match[2]) : stat.size - 1
          if (start >= stat.size || end >= stat.size || start > end) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${stat.size}` },
            })
          }
          const chunk = fileBuffer.subarray(start, end + 1)
          return new Response(chunk, {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Length': String(chunk.length),
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
            },
          })
        }
      }

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
        },
      })
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