import type { DB } from '@/database/types'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import { NodeSqliteDialect } from '@fileshed/kysely-node-sqlite'
import { Kysely } from 'kysely'
import { Migrator } from 'kysely/migration'
import { DSH_PLUGIN_HOME } from '@/config/paths'
import { migrations } from '@/database/migrations'
import { <Domain> } from '@/database/models/<domain>'
import { MigrationProvider } from '@/database/utils/migration'

const worker = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID
const name = worker ? `data.worker-${worker}.db` : 'data.db'
const file = worker ? name : join(DSH_PLUGIN_HOME, name)
if (!worker)
  mkdirSync(DSH_PLUGIN_HOME, { recursive: true })

const database = new DatabaseSync(file)
const connection = new Kysely<DB>({ dialect: new NodeSqliteDialect({ database }) })

export const db = Object.assign(connection, {
  <domain>: new <Domain>(connection),
})

const { error } = await new Migrator({
  db,
  provider: new MigrationProvider(database, migrations),
}).migrateToLatest()
if (error)
  throw error
