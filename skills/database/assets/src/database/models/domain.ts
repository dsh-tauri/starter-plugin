import type { Insertable, Kysely, Selectable, Updateable } from 'kysely'
import type { DB } from '@/database/types'
import { Model } from 'kysely-model'

let creation: Promise<unknown> = Promise.resolve()

export class <Domain> extends Model<DB, '<table>'> {
  constructor(db: Kysely<DB>) {
    super(db, '<table>', 'id')
  }

  async findById(id: string): Promise<Selectable<DB['<table>']> | undefined> {
    return this.db.selectFrom('<table>').selectAll().where('id', '=', id).executeTakeFirst()
  }

  async listByProject(projectId: string): Promise<Selectable<DB['<table>']>[]> {
    return this.db
      .selectFrom('<table>')
      .selectAll()
      .where('projectId', '=', projectId)
      .orderBy('updatedAt', 'desc')
      .execute()
  }

  async create(row: Insertable<DB['<table>']>): Promise<Selectable<DB['<table>']>> {
    const operation = creation.then(() => this.db.transaction().execute(async (trx) => {
      await trx.insertInto('<table>').values(row).execute()
      return (await new <Domain>(trx).findById(row.id))!
    }))
    creation = operation.catch(() => undefined)
    return operation
  }

  async save(id: string, patch: Updateable<DB['<table>']>): Promise<void> {
    await this.db.updateTable('<table>').set(patch).where('id', '=', id).execute()
  }
}
