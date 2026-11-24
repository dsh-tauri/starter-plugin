import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commands } from './setup'

describe('dSH shell smoke test', () => {
  beforeAll(commands.launch)
  afterAll(commands.close)

  it('opens the authenticated shell', async () => {
    const url = new URL((await commands.page()).url())
    expect(url.protocol).toMatch(/^https?:$/u)
    expect(url.pathname).toBe('/')
  })

  it('renders the shell', async () => {
    const page = await commands.page()
    expect(await page.locator('body').isVisible()).toBe(true)
    expect(await page.title()).not.toBe('')
  })
})
