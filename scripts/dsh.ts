/**
 * 起一个专门用于开发的 DSH 实例：用独立 profile，把本仓当插件装进去。
 *
 * 为什么不用 desktop profile：它被 Electron 独占（`dsh --profile desktop` 直接报错），
 * 而且改坏了会影响正在用的 GUI。
 *
 * 热更新靠两层，profile 里两行都是开着的：
 *   - `hmr`（`@deepseek-ai/dsh-hmr`）：已链接包的构建产物一变，Host 插件就被换掉，不用重启；
 *   - `client-hmr`（`@deepseek-ai/dsh-client-hmr`）：Client 模块热替换，页面不用刷新。
 * 但这两层都只认**磁盘上已经变化的产物**，所以这里必须先开 watch 重建，否则改了源码
 * `dist/` 不动，什么都不会热。
 *
 * 用法：
 *   pnpm run dev:dsh            # 构建一次 + 持续 watch，然后起实例
 *   pnpm run dev:dsh --once     # 只构建一次，不 watch
 *   pnpm run dev:dsh --no-open  # 不自动开浏览器
 *   pnpm run dev:dsh --no-build # 复用已有构建，不再启动 watcher
 *
 * 环境变量：
 *   DSH_DEV_PROFILE   profile 名，默认 dev
 *   DSH_DEV_PORT      端口，默认 3091
 *   DSH_DEV_CLI       官方 lib/bin.js，设置后绕过 Desktop 全局 shim
 *   DSH_DEV_NODE      执行官方 CLI 的运行时，默认 process.execPath
 */
import type { ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PROFILE = process.env.DSH_DEV_PROFILE ?? 'dev'
const PORT = process.env.DSH_DEV_PORT ?? '3091'
const PROFILE_DIR = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', PROFILE)
const LINK = `link:${REPO_ROOT.replace(/\\/gu, '/')}`
const TSDOWN = join(REPO_ROOT, 'node_modules/tsdown/dist/run.mjs')
const NODE = process.env.DSH_DEV_NODE ?? process.execPath
const CLI = process.env.DSH_DEV_CLI

const BUILD = !process.argv.includes('--no-build')
const WATCH = BUILD && !process.argv.includes('--once')
const OPEN = !process.argv.includes('--no-open')

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  }
  catch {
    return undefined
  }
}

function packageName(): string {
  const name = readJson<{ name?: string }>(join(REPO_ROOT, 'package.json'))?.name
  if (!name)
    throw new Error(`package.json has no name: ${join(REPO_ROOT, 'package.json')}`)
  return name
}

const PACKAGE_NAME = packageName()

/** 跑一条命令，输出直通当前终端；非零退出即失败。 */
async function run(command: string, args: string[], cwd = REPO_ROOT): Promise<void> {
  const { exitCode } = await x(command, args, { nodeOptions: { cwd, stdio: 'inherit', windowsHide: true } })
  if (exitCode !== 0)
    throw new Error(`\`${command} ${args.join(' ')}\` exited ${exitCode}`)
}

/** 官方 CLI：设了 DSH_DEV_CLI 就用指定运行时跑它，否则用 PATH 上的 dsh。 */
function dsh(...args: string[]): Promise<void> {
  // 设了 DSH_HOME 就在它下面解析 profile；没设就留在仓库根，不往用户家目录写东西。
  const cwd = process.env.DSH_HOME ?? REPO_ROOT
  return CLI ? run(NODE, [CLI, ...args], cwd) : run('dsh', args, cwd)
}

/** profile 不存在时从 shipped 的 web 模板建一个。`--dump-config` 让它建完即退，不起服务。 */
async function ensureProfile(): Promise<void> {
  if (existsSync(join(PROFILE_DIR, 'package.json')))
    return
  console.log(`[dev:dsh] creating profile "${PROFILE}" from the shipped web template`)
  await dsh(PROFILE, '--from-default-profile', 'web', '--dump-config')
  if (!existsSync(join(PROFILE_DIR, 'package.json')))
    throw new Error(`profile "${PROFILE}" was not created at ${PROFILE_DIR}`)
}

/**
 * 让 profile 用 `link:` 指向本仓。
 *
 * link 而不是打包安装：`pnpm run dev` 重建的 `dist/` 立刻就在 profile 的 node_modules 里，
 * 不用每次改完都重新 pack + install。
 */
async function ensureLinked(): Promise<void> {
  const manifest = readJson<{ dependencies?: Record<string, string> }>(join(PROFILE_DIR, 'package.json'))
  if (manifest?.dependencies?.[PACKAGE_NAME] === LINK)
    return
  console.log(`[dev:dsh] linking ${PACKAGE_NAME} -> ${REPO_ROOT}`)
  await dsh('plugin', '--profile', PROFILE, 'add', '--ignore-scripts', LINK)
}

const children: ChildProcess[] = []

function stopChildren(): void {
  for (const child of children) {
    if (child.exitCode !== null || child.pid === undefined)
      continue
    try {
      process.kill(child.pid)
    }
    catch {
      // 已经退出了
    }
  }
}

async function main(): Promise<void> {
  await ensureProfile()
  await ensureLinked()

  // 先完整构建一次：watch 的首轮产物要等它自己编译，实例不该在空 dist 上启动。
  if (BUILD)
    await run(NODE, [TSDOWN])
  else
    console.log('[dev:dsh] --no-build: reusing existing artifacts; no build or watcher started')

  if (WATCH) {
    // tsdown --watch 之后每次源码变动都会重写 dist/，由 DSH 的 hmr / client-hmr 接手。
    const watcher = x(NODE, [TSDOWN, '--watch'], {
      nodeOptions: { cwd: REPO_ROOT, stdio: 'inherit', windowsHide: true },
      persist: true,
    })
    if (watcher.process)
      children.push(watcher.process)
    console.log('[dev:dsh] watching sources; Host 与 Client 都由 DSH 热替换')
  }

  const args = ['--profile', PROFILE, '--port', PORT]
  if (!OPEN)
    args.push('--no-open')
  console.log(`[dev:dsh] booting profile "${PROFILE}" on http://127.0.0.1:${PORT}`)
  await dsh(...args)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopChildren()
    process.exit(0)
  })
}

try {
  await main()
}
finally {
  stopChildren()
}
