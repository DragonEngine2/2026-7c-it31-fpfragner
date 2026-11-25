import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Tabellen-Definition in TypeScript. Daraus erzeugt "npm run db:generate" die SQL-Migration.
export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  category: text('category').notNull().default('Allgemein'),
  note: text('note').notNull().default(''),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  rating: integer('rating').notNull().default(3),
  createdAt: text('created_at').notNull(),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
})
