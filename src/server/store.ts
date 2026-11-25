import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { Item, ItemInput, ItemPatch, User } from '../shared/schemas'
import { itemRecord } from '../shared/schemas'

// Eine "Store"-Schnittstelle: Die API weiß nicht, WO die Daten liegen.
//   Aufgabe 2: MemoryStore  (Daten nur im Arbeitsspeicher)
//   Aufgabe 4: SqliteStore  (Daten dauerhaft in einer SQLite-Datei)
//   Aufgabe 7: LocalStore   (im Browser, siehe src/client/api.ts)
export interface Store {
  list(): Promise<Item[]>
  create(input: ItemInput): Promise<Item>
  update(id: number, patch: ItemPatch): Promise<Item | undefined>
  remove(id: number): Promise<boolean>
}

export interface StoredUser extends User {
  passwordHash: string
  createdAt: string
}

export interface UserStore {
  findUserByUsername(username: string): Promise<StoredUser | undefined>
  findUserById(id: number): Promise<StoredUser | undefined>
  createUser(username: string, passwordHash: string): Promise<StoredUser>
}

export function createMemoryUserStore(): UserStore {
  const users: StoredUser[] = []
  let nextId = 1

  return {
    async findUserByUsername(username) {
      return users.find((user) => user.username === username)
    },
    async findUserById(id) {
      return users.find((user) => user.id === id)
    },
    async createUser(username, passwordHash) {
      const user: StoredUser = {
        id: nextId++,
        username,
        passwordHash,
        createdAt: new Date().toISOString(),
      }
      users.push(user)
      return user
    },
  }
}

export function createMemoryStore(seed: Item[] = []): Store {
  let items = [...seed]
  let nextId = items.reduce((max, i) => Math.max(max, i.id), 0) + 1

  return {
    async list() {
      return items
    },
    async create(input) {
      const item: Item = {
        id: nextId++,
        ...input,
        category: input.category ?? 'Allgemein',
        note: input.note ?? '',
        rating: input.rating ?? 3,
        done: false,
        createdAt: new Date().toISOString(),
      }
      items.push(item)
      return item
    },
    async update(id, patch) {
      const item = items.find((i) => i.id === id)
      if (!item) return undefined
      Object.assign(item, patch)
      return item
    },
    async remove(id) {
      const before = items.length
      items = items.filter((i) => i.id !== id)
      return items.length < before
    },
  }
}

export function createJsonStore(
  seed: Item[] = [],
  filePath = path.resolve(process.cwd(), 'data', 'items.json'),
): Store {
  let items = seed.map((item) => ({ ...item }))
  let nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1
  let queue: Promise<void> = Promise.resolve()

  const ready = (async () => {
    let contents: string
    try {
      contents = await readFile(filePath, 'utf8')
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
      throw error
    }

    const parsed = z.array(itemRecord).safeParse(JSON.parse(contents))
    if (!parsed.success) {
      throw new Error(`Ungültige Einträge in ${filePath}: ${parsed.error.message}`)
    }
    items = parsed.data
    nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1
  })()

  async function persist(nextItems: Item[]) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const tempPath = `${filePath}.${randomUUID()}.tmp`
    try {
      await writeFile(tempPath, JSON.stringify(nextItems, null, 2), { encoding: 'utf8', flag: 'wx' })
      await rename(tempPath, filePath)
    } catch (error) {
      try {
        await unlink(tempPath)
      } catch (cleanupError) {
        if (!(cleanupError instanceof Error && 'code' in cleanupError && cleanupError.code === 'ENOENT')) {
          throw cleanupError
        }
      }
      throw error
    }
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(async () => {
      await ready
      return operation()
    })
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    async list() {
      await queue
      await ready
      return items.map((item) => ({ ...item }))
    },
    create(input) {
      return enqueue(async () => {
        const item: Item = {
          id: nextId,
          ...input,
          category: input.category ?? 'Allgemein',
          note: input.note ?? '',
          rating: input.rating ?? 3,
          done: false,
          createdAt: new Date().toISOString(),
        }
        const nextItems = [...items, item]
        await persist(nextItems)
        items = nextItems
        nextId += 1
        return { ...item }
      })
    },
    update(id, patch) {
      return enqueue(async () => {
        const existing = items.find((item) => item.id === id)
        if (!existing) return undefined

        const updated = { ...existing, ...patch }
        const nextItems = items.map((item) => (item.id === id ? updated : item))
        await persist(nextItems)
        items = nextItems
        return { ...updated }
      })
    },
    remove(id) {
      return enqueue(async () => {
        if (!items.some((item) => item.id === id)) return false

        const nextItems = items.filter((item) => item.id !== id)
        await persist(nextItems)
        items = nextItems
        return true
      })
    },
  }
}
