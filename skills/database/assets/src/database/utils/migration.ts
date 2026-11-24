import type { Migration, MigrationProvider as MigrationProviderContract } from 'kysely/migration'
import type { DatabaseSync } from 'node:sqlite'

/**
 * 把 SQL 文本包成 Kysely 迁移。
 *
 * 两个坑都在这里绕开：
 * 1. Kysely 的 SQLite 适配器用 `prepare()` 执行，多语句不报错、只跑第一条，
 *    所以改用 `DatabaseSync.exec()`，让 SQLite 自己解析整段脚本。
 * 2. 适配器的 `supportsTransactionalDdl` 为 false，迁移不会被自动包进事务，
 *    所以这里手动 BEGIN/COMMIT，一个迁移文件要么整篇生效、要么整篇回滚。
 */
export class MigrationProvider implements MigrationProviderContract {
  private readonly database: DatabaseSync
  private readonly migrations: Record<string, string>

  constructor(database: DatabaseSync, migrations: Record<string, string>) {
    this.database = database
    this.migrations = migrations
  }

  async getMigrations(): Promise<Record<string, Migration>> {
    return Object.fromEntries(
      Object.entries(this.migrations).map(([name, sql]) => [
        name,
        {
          up: async (): Promise<void> => {
            const foreignKeys = this.database.prepare('PRAGMA foreign_keys').get()?.foreign_keys
            this.database.exec('PRAGMA foreign_keys=OFF')
            this.database.exec('BEGIN')
            try {
              this.database.exec(sql)
              if (this.database.prepare('PRAGMA foreign_key_check').all().length)
                throw new Error(`Migration violates foreign key constraints: ${name}`)
              this.database.exec('COMMIT')
            }
            catch (error) {
              this.database.exec('ROLLBACK')
              throw error
            }
            finally {
              this.database.exec(foreignKeys ? 'PRAGMA foreign_keys=ON' : 'PRAGMA foreign_keys=OFF')
            }
          },
        },
      ]),
    )
  }
}
