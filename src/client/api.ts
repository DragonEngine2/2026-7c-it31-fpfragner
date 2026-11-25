import type { Item, ItemInput, ItemPatch, User } from '../shared/schemas'
import seed from '../../data/seed.json'

interface UploadResult {
  url: string
  filename: string
}

export interface Api {
  me(): Promise<User | null>
  login(username: string, password: string): Promise<User>
  register(username: string, password: string): Promise<User>
  logout(): Promise<void>
  upload(file: File): Promise<UploadResult>
  list(): Promise<Item[]>
  create(input: ItemInput): Promise<Item>
  update(id: number, patch: ItemPatch): Promise<Item>
  remove(id: number): Promise<void>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `API-Fehler ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

const httpApi: Api = {
  me: async () => {
    const result = await request<{ user: User | null }>('/auth/me')
    return result.user
  },
  login: async (username, password) => {
    const result = await request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return result.user
  },
  register: async (username, password) => {
    const result = await request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return result.user
  },
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  async upload(file) {
    const formData = new FormData()
    formData.append('file', file)
    return request<UploadResult>('/upload', { method: 'POST', body: formData })
  },
  list: () => request('/items'),
  create: (input) => request('/items', { method: 'POST', body: JSON.stringify(input) }),
  update: (id, patch) => request(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id) => request<void>(`/items/${id}`, { method: 'DELETE' }),
}

// --- Aufgabe 7: Statischer Modus ohne Backend (localStorage) -------------------------
const KEY = 'kepler-fullstack-items'

function load(): Item[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Item[]
  } catch {
    /* localStorage nicht verfügbar (z. B. Privatmodus) -> Demodaten */
  }
  return (seed as Item[]).map((item) => ({ ...item, rating: item.rating ?? 3 }))
}

function save(items: Item[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* ignorieren */
  }
}

const localApi: Api = {
  me: httpApi.me,
  login: httpApi.login,
  register: httpApi.register,
  logout: httpApi.logout,
  upload: httpApi.upload,
  async list() {
    return load()
  },
  async create(input) {
    const items = load()
    const item: Item = {
      id: items.reduce((m, i) => Math.max(m, i.id), 0) + 1,
      ...input,
      category: input.category ?? 'Allgemein',
      note: input.note ?? '',
      rating: input.rating ?? 3,
      done: false,
      createdAt: new Date().toISOString(),
    }
    save([...items, item])
    return item
  },
  async update(id, patch) {
    const items = load()
    const item = items.find((i) => i.id === id)
    if (!item) throw new Error('Nicht gefunden')
    Object.assign(item, patch)
    save(items)
    return item
  },
  async remove(id) {
    save(load().filter((i) => i.id !== id))
  },
}

export const api: Api = import.meta.env.MODE === 'static' ? localApi : httpApi
