import { eq } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type { Item, ItemInput, ItemPatch } from '../shared/schemas'
import type { Store, StoredUser, UserStore } from './store'
import * as schema from './db/schema'

type Database = LibSQLDatabase<typeof schema>

export function createSqliteStore(db: Database): Store & UserStore {
  return {
    async list() {
      return db.select().from(schema.items).orderBy(schema.items.id)
    },
    async create(input: ItemInput) {
      const [item] = await db
        .insert(schema.items)
        .values({
          ...input,
          category: input.category ?? 'Allgemein',
          note: input.note ?? '',
          rating: input.rating ?? 3,
          done: false,
          createdAt: new Date().toISOString(),
        })
        .returning()
      return item
    },
    async update(id: number, patch: ItemPatch) {
      const [item] = await db
        .update(schema.items)
        .set(patch)
        .where(eq(schema.items.id, id))
        .returning()
      return item
    },
    async remove(id: number) {
      const removed = await db
        .delete(schema.items)
        .where(eq(schema.items.id, id))
        .returning({ id: schema.items.id })
      return removed.length > 0
    },
    async findUserByUsername(username): Promise<StoredUser | undefined> {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username))
      return user
    },
    async findUserById(id): Promise<StoredUser | undefined> {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id))
      return user
    },
    async createUser(username, passwordHash): Promise<StoredUser> {
      const [user] = await db
        .insert(schema.users)
        .values({ username, passwordHash, createdAt: new Date().toISOString() })
        .returning()
      return user
    },
  }
}
