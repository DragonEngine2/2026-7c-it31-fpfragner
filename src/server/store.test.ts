import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Item } from '../shared/schemas'
import { createJsonStore } from './store'

describe('JSON-Store', () => {
  it('behält Einträge über eine neue Store-Instanz hinweg', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'video-katalog-'))
    const filePath = path.join(directory, 'items.json')
    const seed: Item = {
      id: 1,
      title: 'Startvideo',
      category: 'Allgemein',
      note: '',
      done: false,
      rating: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    try {
      const firstStore = createJsonStore([seed], filePath)
      const created = await firstStore.create({
        title: 'Hochgeladenes Video',
        category: 'Live-Action',
        note: '/api/uploads/clip.mp4',
      })

      const restartedStore = createJsonStore([], filePath)
      expect(await restartedStore.list()).toEqual([seed, created])

      await restartedStore.update(created.id, { done: true })
      const secondRestart = createJsonStore([], filePath)
      expect((await secondRestart.list()).find((item) => item.id === created.id)?.done).toBe(true)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
