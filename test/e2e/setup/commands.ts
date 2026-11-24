import type { Browser, Page } from 'playwright'
import type { ShellScaffold } from './shell'
import { chromium } from 'playwright'
import { launchShell } from './shell'
import { cookieHeader, readBody } from './shell.utils'

const VIEWPORT = { width: 1440, height: 900 }

// E2E runs with `fileParallelism: false`, so at most one DSH instance is alive at a time.
let scaffold: ShellScaffold | undefined
let browser: Browser | undefined
let current: Page | undefined

/** The current DSH page, or a freshly opened one. */
export async function page(fresh = false): Promise<Page> {
  assertBrowser()
  if (fresh) {
    current = await newDshPage()
    return current
  }
  assertLaunched()
  return current!
}

/** Boot DSH in an isolated `DSH_HOME` and return the Chromium page showing its shell. */
export async function launch(): Promise<Page> {
  await close()

  scaffold = await launchShell()
  try {
    browser = await chromium.launch()
    return await page(true)
  }
  catch (error) {
    await close()
    throw error
  }
}

export async function close(): Promise<void> {
  try {
    await browser?.close()
  }
  finally {
    await scaffold?.close()
    scaffold = undefined
    browser = undefined
    current = undefined
  }
}

/** Boot again on the same `DSH_HOME` — the only way to see what profile writes did. */
export async function restart(): Promise<Page> {
  assertLaunched()
  await current!.context().close()
  await scaffold!.restart()
  return page(true)
}

export async function reload(): Promise<void> {
  assertLaunched()
  await current!.reload({ waitUntil: 'load' })
}

/** `fetch` the host from Node with the browser's session cookie attached. */
export async function request(path: string, init: RequestInit = {}): Promise<{ status: number, body: unknown }> {
  assertLaunched()
  const headers = new Headers(init.headers)
  const cookie = cookieHeader(scaffold!.cookie?.cookie ?? null)
  if (cookie)
    headers.set('cookie', cookie)
  const response = await fetch(`${scaffold!.baseUrl}${path}`, { ...init, headers })
  return { status: response.status, body: await readBody(response) }
}

/* ---- Internal helpers ---- */

function assertBrowser(): void {
  if (!browser)
    throw new Error('Browser is not running: call commands.launch() first')
}

function assertLaunched(): void {
  if (!scaffold || !current)
    throw new Error('DSH is not running: call commands.launch() first')
}

/** A fresh browser context carrying the session cookie, landed on the shell. */
async function newDshPage(): Promise<Page> {
  const context = await browser!.newContext({ viewport: VIEWPORT })
  if (scaffold!.cookie)
    await context.addCookies([scaffold!.cookie.cookie])
  const page = await context.newPage()
  // DSH is a single page app, so this navigation is the whole app.
  await page.goto(scaffold!.baseUrl, { waitUntil: 'load' })
  return page
}
