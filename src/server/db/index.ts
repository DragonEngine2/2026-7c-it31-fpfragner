import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'

export async function createDatabase() {
  const dbPath = path.resolve(process.cwd(), 'data', 'app.db')
  await mkdir(path.dirname(dbPath), { recursive: true })

  const client = createClient({ url: pathToFileURL(dbPath).href })
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') })
  return db
}
