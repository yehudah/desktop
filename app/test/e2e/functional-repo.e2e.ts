/* eslint-disable no-sync */

/**
 * Functional E2E: open a real temp git repository through --cli-open, see its
 * modified files in the Changes list and commit them from the UI. The commit
 * is verified with real `git` in the temp repo.
 *
 * This spec launches its own app instance (separate user-data dir and repo)
 * so it does not depend on the shared fixture's smoke repository.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { _electron as electron } from 'playwright'
import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect, getE2ELaunchOptions } from './e2e-fixtures'
import { createTempRepository, gitInRepo } from './test-helpers'

test.describe.configure({ mode: 'serial' })

const newFileName = 'functional-new.txt'
const commitSummary = 'Functional e2e commit'

test.describe('Functional repository flow', () => {
  let app: ElectronApplication
  let page: Page
  let repoPath: string
  let dataDir: string
  let fakeHome: string

  test.beforeAll(async () => {
    repoPath = createTempRepository(newFileName, 'hello from the e2e\n')
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-e2e-data-'))
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-e2e-home-'))

    const { missingPath, ...options } = getE2ELaunchOptions(repoPath, dataDir)
    if (!fs.existsSync(missingPath)) {
      throw new Error(`E2E app not found at ${missingPath}.`)
    }

    app = await electron.launch({
      ...options,
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: path.join(fakeHome, '.gitconfig'),
        GIT_CONFIG_SYSTEM: path.join(fakeHome, '.gitconfig-system'),
        XDG_CONFIG_HOME: path.join(fakeHome, '.config'),
        SSH_AUTH_SOCK: '',
        GIT_SSH_COMMAND: 'false',
      },
      timeout: 30000,
    })
    page = await app.firstWindow()
  })

  test.afterAll(async () => {
    await app?.close().catch(() => {})
    for (const dir of [repoPath, dataDir, fakeHome]) {
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test('runs the binary selected by DESKTOP_E2E_APP_PATH when set', async () => {
    test.skip(
      process.env.DESKTOP_E2E_APP_PATH === undefined,
      'DESKTOP_E2E_APP_PATH not set; running the staged build.'
    )
    const execPath = await app.evaluate(() => process.execPath)
    expect(fs.realpathSync(execPath)).toBe(
      fs.realpathSync(process.env.DESKTOP_E2E_APP_PATH!)
    )
  })

  test('opens the repo via --cli-open and lists its changes', async () => {
    await page.waitForFunction(
      () =>
        (document.getElementById('desktop-app-container')?.innerHTML.length ??
          0) > 100,
      null,
      { timeout: 30000 }
    )

    // First-run welcome flow
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

    // --cli-open of a repo Desktop doesn't know yet opens the Add Repository
    // dialog prefilled with the path.
    const addDialog = page.locator('dialog#add-existing-repository')
    await addDialog.waitFor({ state: 'visible', timeout: 15000 })
    await expect(
      addDialog.locator('input[placeholder="repository path"]')
    ).toHaveValue(repoPath)
    await addDialog
      .locator(
        'button:has-text("Add Repository"), button:has-text("Add repository")'
      )
      .click()

    const changesList = page.locator('.changes-list-container')
    await expect(changesList).toContainText(newFileName, { timeout: 20000 })
    await expect(changesList).toContainText('README.md')

    if (process.env.DESKTOP_E2E_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.DESKTOP_E2E_SCREENSHOT_PATH })
    }
  })

  test('commits the changes from the UI and git log shows the commit', async () => {
    const before = gitInRepo(repoPath, 'rev-list', '--count', 'HEAD')
    expect(before).toBe('1')

    await page
      .getByRole('combobox', { name: 'Commit summary' })
      .fill(commitSummary)
    await page.locator('[aria-label="Create commit"] .commit-button').click()

    await expect
      .poll(() => gitInRepo(repoPath, 'log', '-1', '--pretty=%s'), {
        timeout: 20000,
      })
      .toBe(commitSummary)

    expect(gitInRepo(repoPath, 'rev-list', '--count', 'HEAD')).toBe('2')
    expect(gitInRepo(repoPath, 'log', '-1', '--pretty=%an <%ae>')).toBe(
      'GitHub Desktop E2E <desktop-e2e@example.com>'
    )
    const files = gitInRepo(
      repoPath,
      'show',
      '--name-only',
      '--pretty=format:',
      'HEAD'
    )
      .split('\n')
      .sort()
    expect(files).toEqual(['README.md', newFileName].sort())
    expect(gitInRepo(repoPath, 'status', '--short')).toBe('')
  })
})
