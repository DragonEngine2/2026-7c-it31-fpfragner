import { z } from 'zod'

// Gemeinsame Typen für Frontend UND Backend (eine Quelle der Wahrheit).
// Tipp: Benenne "Item" in dein eigenes Thema um (z. B. Workout, Rezept, Spiel).

export const itemInput = z.object({
  title: z.string().trim().min(1, 'Titel fehlt').max(80),
  category: z.string().trim().min(1).max(40).default('Allgemein'),
  note: z.string().trim().max(500).default(''),
  rating: z.number().int().min(1).max(5).default(3),
})

export const itemPatch = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  note: z.string().trim().max(500).optional(),
  done: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional(),
})

export const itemRecord = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  note: z.string().max(500),
  done: z.boolean(),
  rating: z.number().int().min(1).max(5).default(3),
  createdAt: z.string().min(1),
})

export const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/),
  password: z.string().min(8).max(128),
})

export type ItemInput = z.input<typeof itemInput>
export type ItemPatch = z.infer<typeof itemPatch>

export interface Item {
  id: number
  title: string
  category: string
  note: string
  done: boolean
  rating: number
  createdAt: string
}

export interface User {
  id: number
  username: string
}
