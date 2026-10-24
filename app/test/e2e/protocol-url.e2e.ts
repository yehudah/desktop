/* eslint-disable no-sync */

/**
 * Linux protocol URL handling: the desktop entry runs
 * `github-desktop %U`, so an `x-github-client://` URL arrives as a plain
 * argument, either on cold start or forwarded to the running instance via
 * `second-instance`. `x-github-client://openRepo/<url>` must open the Clone
 * dialog prefilled with <url> in both cases.
 *
 * This spec launches its own app instance (separate user-data dir) so the
 * second launch hits the same single-instance lock.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { _electron as electron } from 'playwright'
import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect, getE2ELaunchOptions } from './e2e-fixtures'

test.describe.configure({ mode: 'serial' })

const coldStartRepoURL = 'https://example.invalid/desktop/cold-start.git'
const secondInstanceRepoURL =
  'https://example.invalid/desktop/second-instance.git'

function openRepoURL(repoURL: string) {
  return `x-github-client://openRepo/${repoURL}`
}

test.describe('Protocol URL arguments (Linux)', () => {
  test.skip(
    process.platform !== 'linux',
    'Protocol URLs only arrive as argv on Linux.'
  )

  let app: ElectronApplication
  let page: Page
  let dataDir: string
  let fakeHome: string
  let executablePath: string
  let baseArgs: string[]
  let env: Record<string, string>

  test.beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-e2e-data-'))
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-e2e-home-'))

    const options = getE2ELaunchOptions(undefined, dataDir)
    if (!fs.existsSync(options.missingPath)) {
      throw new Error(`E2E app not found at ${options.missingPath}.`)
    }
    // No --cli-open here: the protocol URL is the only request.
    baseArgs = options.args.filter(a => !a.startsWith('--cli-open='))
    executablePath = options.executablePath ?? require('electron')
    env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: path.join(fakeHome, '.gitconfig'),
      GIT_CONFIG_SYSTEM: path.join(fakeHome, '.gitconfig-system'),
      XDG_CONFIG_HOME: path.join(fakeHome, '.config'),
      SSH_AUTH_SOCK: '',
      GIT_SSH_COMMAND: 'false',
    } as Record<string, string>

    app = await electron.launch({
      executablePath,
      args: [...baseArgs, openRepoURL(coldStartRepoURL)],
      env,
      timeout: 30000,
    })
    page = await app.firstWindow()
  })

  test.afterAll(async () => {
    await app?.close().catch(() => {})
    for (const dir of [dataDir, fakeHome]) {
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  async function expectCloneDialogWith(repoURL: string) {
    const cloneDialog = page.locator('dialog.clone-repository')
    await cloneDialog.waitFor({ state: 'visible', timeout: 20000 })
    await expect(
      cloneDialog.locator('input[placeholder="URL or username/repository"]')
    ).toHaveValue(repoURL)
    // Dialogs ignore dismissal for a short grace period after opening.
    await expect(async () => {
      if (await cloneDialog.isVisible()) {
        await cloneDialog
          .locator('button:has-text("Cancel")')
          .click({ timeout: 1000 })
      }
      await expect(cloneDialog).toBeHidden({ timeout: 1000 })
    }).toPass({ timeout: 15000 })
  }

  test('cold start with an openRepo URL shows the Clone dialog', async () => {
    await page.waitForFunction(
      () =>
        (document.getElementById('desktop-app-container')?.innerHTML.length ??
          0) > 100,
      null,
      { timeout: 30000 }
    )

    // First-run welcome flow; the URL action's popup shows once it is done.
    const skipButton = page.locator('a.skip-button')
    await skipButton.waitFor({ state: 'visible', timeout: 30000 })
    await skipButton.click()
    const nameInput = page.locator('input[placeholder="Your Name"]')
    await nameInput.waitFor({ state: 'visible', timeout: 15000 })
    if ((await nameInput.inputValue()) === '') {
      await nameInput.fill('GitHub Desktop E2E')
    }
    const emailInput = page.locator(
      'input[placeholder="your-email@example.com"]'
    )
    if ((await emailInput.inputValue()) === '') {
      await emailInput.fill('desktop-e2e@example.com')
    }
    await page.locator('button:has-text("Finish")').click()
    await page.waitForSelector('#welcome', { state: 'hidden', timeout: 15000 })

    await expectCloneDialogWith(coldStartRepoURL)
  })

  test('a second launch forwards its openRepo URL to the running app', async () => {
    const second = spawn(
      executablePath,
      [...baseArgs, openRepoURL(secondInstanceRepoURL)],
      { env, stdio: 'ignore' }
    )
    // The second instance can't get the single-instance lock and quits.
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        second.kill()
        reject(new Error('second instance did not exit'))
      }, 30000)
      second.on('error', e => {
        clearTimeout(timer)
        reject(e)
      })
      second.on('exit', code => {
        clearTimeout(timer)
        resolve(code)
      })
    })
    expect(exitCode).toBe(0)

    await expectCloneDialogWith(secondInstanceRepoURL)
  })
})
