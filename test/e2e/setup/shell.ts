/* eslint-disable ts/no-use-before-define */
import type { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { dshCommand, exchangeProcessLaunchToken, freePort, stop, trustedProcessLaunchUrl } from './shell.utils'

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PROFILE_NAME = 'dsh.e2e'
const STARTUP_TIMEOUT_MS = 120_000
const COMMAND_TIMEOUT_MS = 180_000
const MAX_OUTPUT_BUFFER_BYTES = 16_384
const PRESERVED_DSH_ENV_KEYS = new Set(['DSH_HOME', 'DSH_AGENTS_HOME', 'DSH_TELEMETRY_DISABLED'])

export interface ShellScaffold {
  baseUrl: string
  home: string
  cookie: Awaited<ReturnType<typeof exchangeProcessLaunchToken>>
  /** Stop the CLI and boot it again on the same `DSH_HOME` and port. */
  restart: () => Promise<void>
  close: () => Promise<void>
}

function createIsolatedEnv(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DSH_HOME: home,
    DSH_AGENTS_HOME: join(home, 'agents'),
    DSH_TELEMETRY_DISABLED: '1',
    npm_config_ignore_scripts: 'true',
    CI: 'true',
  }

  for (const key of Object.keys(env)) {
    if (key.startsWith('DSH_') && !PRESERVED_DSH_ENV_KEYS.has(key))
      delete env[key]
  }

  return env
}

function waitForLaunchUrl(child: NonNullable<ReturnType<typeof x>['process']>, baseUrl: string): Promise<string> {
  return new Promise<string>((resolveUrl, rejectUrl) => {
    let output = ''
    let settled = false

    function cleanupListeners() {
      clearTimeout(timer)
      child.off('exit', onExit)
      child.off('error', onError)
      for (const stream of [child.stdout, child.stderr])
        stream?.off('data', onData)
    }

    function finishResolve(url: string) {
      if (settled)
        return
      settled = true
      cleanupListeners()
      resolveUrl(url)
    }

    function finishReject(err: Error) {
      if (settled)
        return
      settled = true
      cleanupListeners()
      rejectUrl(err)
    }

    const timer = setTimeout(() => finishReject(new Error('isolated DSH startup timed out')), STARTUP_TIMEOUT_MS)

    function onExit() {
      const sanitized = output.replace(/token=\S+/gu, 'token=[redacted]')
      finishReject(new Error(`DSH exited: ${sanitized}`))
    }

    function onError(error: Error) {
      finishReject(error)
    }

    function onData(chunk: Buffer) {
      output = (output + chunk.toString()).slice(-MAX_OUTPUT_BUFFER_BYTES)
      for (const line of output.split(/\r?\n/u)) {
        const match = /^dsh web:\s+(https?:\/\/\S+)\s*$/u.exec(line)
        const candidateUrl = match?.[1]
        if (candidateUrl && trustedProcessLaunchUrl(baseUrl, candidateUrl) !== null) {
          finishResolve(candidateUrl)
          return
        }
      }
    }

    child.once('exit', onExit)
    child.once('error', onError)
    for (const stream of [child.stdout, child.stderr])
      stream?.on('data', onData)
  })
}

export async function launchShell(): Promise<ShellScaffold> {
  const cli = dshCommand()
  const tempRoot = resolve(REPO_ROOT, '.temp')
  await mkdir(tempRoot, { recursive: true })
  const home = await mkdtemp(join(tempRoot, 'dsh-e2e-'))
  const env = createIsolatedEnv(home)
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const patchPath = join(home, 'test.cordis.patch.yml')

  function run(args: string[]) {
    return x(cli, args, {
      timeout: COMMAND_TIMEOUT_MS,
      throwOnError: true,
      nodeOptions: { cwd: home, env, windowsHide: true },
    })
  }

  let child: ReturnType<typeof x>['process']
  let cookie: ShellScaffold['cookie'] = null
  let closed = false

  async function stopChild(): Promise<void> {
    const running = child
    child = undefined
    if (running)
      await stop(running)
  }

  /** Spawn the CLI on this scaffold's home and port, then exchange the launch token. */
  async function boot(): Promise<void> {
    const started = x(
      cli,
      ['--profile', PROFILE_NAME, '--patch', patchPath, '--port', String(port), '--no-open'],
      {
        nodeOptions: { cwd: home, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
      },
    )

    child = started.process
    if (!child)
      throw new Error('failed to start isolated DSH CLI')

    cookie = await exchangeProcessLaunchToken(baseUrl, await waitForLaunchUrl(child, baseUrl))
  }

  async function close(): Promise<void> {
    if (closed)
      return
    closed = true
    await stopChild()
    await rm(home, { recursive: true, force: true })
  }

  async function restart(): Promise<void> {
    if (closed)
      throw new Error('cannot restart a DSH shell that was already closed')
    await stopChild()
    await boot()
  }

  try {
    await run(['--profile', PROFILE_NAME, '--from-default-profile', 'web', '--dump-config'])
    const linkedRepo = REPO_ROOT.replace(/\\/gu, '/')
    await run(['plugin', '--profile', PROFILE_NAME, 'add', '--ignore-scripts', `link:${linkedRepo}`])
    await writeFile(patchPath, '- id: ui-settings-models\n  config:\n    credentialOnboarding: false\n')
    await boot()

    return {
      baseUrl,
      home,
      get cookie() {
        return cookie
      },
      restart,
      close,
    }
  }
  catch (error) {
    await close()
    throw error
  }
}
