import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const MIGRATIONS_DIR = join(REPO_ROOT, 'prisma/migrations')
const DATABASE_DIR = join(REPO_ROOT, 'prisma/database')
const OUTPUT = join(REPO_ROOT, 'src/database/migrations.ts')

const indent = (sql: string): string => sql.split('\n').map(line => (line.trim() ? `    ${line}` : '')).join('\n')

async function main(): Promise<void> {
  rmSync(DATABASE_DIR, { recursive: true, force: true })
  const migrated = await x('pnpm', ['exec', 'prisma', 'migrate', 'dev', '--name', process.argv[2] || ''], {
    nodeOptions: { cwd: REPO_ROOT, stdio: 'inherit' },
  })
  if (migrated.exitCode !== 0)
    throw new Error('prisma migrate dev 失败')

  const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8').trim()
      if (sql.includes('`') || sql.includes('${'))
        throw new Error(`迁移 ${name} 含有模板字符串定界符，无法安全嵌入生成物`)
      return `  '${name}': \`\n${indent(sql)}\n  \`,`
    })

  writeFileSync(OUTPUT, `/* 由 pnpm run prisma:migrate 生成，不要手改。 */\n\nexport const migrations: Record<string, string> = {\n${entries.join('\n\n')}\n}\n`, 'utf8')
  console.log(`[prisma:migrate] ${entries.length} 个迁移 → ${OUTPUT}`)
}

main().catch((error: unknown) => {
  console.error('[prisma:migrate]', error)
  process.exitCode = 1
})
