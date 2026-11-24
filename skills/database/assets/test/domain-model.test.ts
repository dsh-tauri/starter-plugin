import type { DB } from '@/database/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { NodeSqliteDialect } from '@fileshed/kysely-node-sqlite'
import { Kysely } from 'kysely'
import { Migrator } from 'kysely/migration'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrations } from '@/database/migrations'
import { <Domain> } from '@/database/models/<domain>'
import { MigrationProvider } from '@/database/utils/migration'

let directory: string
let database: DatabaseSync
let db: Kysely<DB>

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), '<domain>-'))
  database = new DatabaseSync(join(directory, 'test.db'))
  db = new Kysely<DB>({ dialect: new NodeSqliteDialect({ database }) })
  const { error } = await new Migrator({ db, provider: new MigrationProvider(database, migrations) }).migrateToLatest()
  if (error)
    throw error
})

afterEach(async () => {
  await db.destroy()
  database.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('<Domain>', () => {
  it('写入后按 id 读回同一行', async () => {
    const model = new <Domain>(db)
    const now = new Date().toISOString()
    await model.create({ id: '<prefix>-001', projectId: 'p1', title: 't', description: null, status: 'active', createdAt: now, updatedAt: now })
    expect((await model.findById('<prefix>-001'))?.title).toBe('t')
  })
})
