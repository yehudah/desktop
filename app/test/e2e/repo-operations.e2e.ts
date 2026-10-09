/* eslint-disable no-sync */

/**
 * Functional E2E: History view, branch create/switch and push/fetch against a
 * local bare remote (path remote, no network). Every outcome is verified with
 * real `git` on the temp repositories.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { _electron as electron } from 'playwright'
import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect, getE2ELaunchOptions } from './e2e-fixtures'
import { createTempRepository } from './test-helpers'

test.describe.configure({ mode: 'serial' })

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: os.devNull,
  GIT_CONFIG_SYSTEM: os.devNull,
}

function git(cwd: string, ...args: ReadonlyArray<string>) {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    env: gitEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

const secondCommit = 'Second commit for history'
const uiBranch = 'ui-feature-branch'
const pushedSummary = 'Commit pushed from the UI'
const upstreamSummary = 'Commit made by another clone'

test.describe('Repository operations', () => {
  let app: ElectronApplication
  let page: Page
  let repoPath: string
  let bareDir: string
  let otherClone: string
  let dataDir: string
  let fakeHome: string
  let mainBranch: string

  test.beforeAll(async () => {
    repoPath = createTempRepository('ops-new.txt', 'ops\n')
    // createTempRepository leaves uncommitted changes; commit them so the
    // History view has two commits and the working tree is clean.
    git(repoPath, 'add', '-A')
    git(repoPath, 'commit', '-m', secondCommit)
    mainBranch = git(repoPath, 'branch', '--show-current')

    bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-e2e-bare-'))
    git(bareDir, 'init', '--bare')
    git(repoPath, 'remote', 'add', 'origin', bareDir)
    git(repoPath, 'push', '-u', 'origin', mainBranch)
    git(bareDir, 'symbolic-ref', 'HEAD', `refs/heads/${mainBranch}`)

    otherClone = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-e2e-clone-'))
    git(otherClone, 'clone', bareDir, '.')
    git(otherClone, 'config', 'user.name', 'Other Dev')
    git(otherClone, 'config', 'user.email', 'other@example.com')

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

    await page.waitForFunction(
      () =>
        (document.getElementById('desktop-app-container')?.innerHTML.length ??
          0) > 100,
      null,
      { timeout: 30000 }
    )

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

    const addDialog = page.locator('dialog#add-existing-repository')
    await addDialog.waitFor({ state: 'visible', timeout: 15000 })
    await addDialog
      .locator(
        'button:has-text("Add Repository"), button:has-text("Add repository")'
      )
      .click()
    await expect(page.locator('.branch-button button')).toContainText(
      mainBranch,
      { timeout: 20000 }
    )
  })

  test.afterAll(async () => {
    await app?.close().catch(() => {})
    for (const dir of [repoPath, bareDir, otherClone, dataDir, fakeHome]) {
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test('History view lists the repository commits', async () => {
    await page.locator('#history-tab').click()
    const commits = page.locator('#commit-list .commit')
    await expect(commits.first()).toBeVisible({ timeout: 15000 })
    await expect(commits).toHaveCount(
      Number(git(repoPath, 'rev-list', '--count', 'HEAD'))
    )
    const subjects = git(repoPath, 'log', '--pretty=%s').split('\n')
    for (const subject of subjects) {
      await expect(page.locator('#commit-list')).toContainText(subject)
    }
    await expect(commits.first()).toContainText(secondCommit)
  })

  test('creates a branch from the UI', async () => {
    await page.locator('.branch-button button').click()
    await page.locator('.new-branch-button').click()
    const dialog = page.locator('#create-branch')
    await dialog.waitFor({ state: 'visible', timeout: 15000 })
    await dialog.locator('input').first().fill(uiBranch)
    await dialog
      .locator(
        'button:has-text("Create Branch"), button:has-text("Create branch")'
      )
      .click()

    await expect
      .poll(() => git(repoPath, 'branch', '--show-current'), {
        timeout: 15000,
      })
      .toBe(uiBranch)
    expect(git(repoPath, 'branch', '--list', uiBranch)).toContain(uiBranch)
  })

  test('switches back to the original branch from the UI', async () => {
    await page.locator('.branch-button button').click()
    await page
      .locator(
        `//div[contains(@class, "branches-list-item")]//div[contains(@class, "name") and normalize-space()="${mainBranch}"]`
      )
      .click()
    await expect
      .poll(() => git(repoPath, 'branch', '--show-current'), {
        timeout: 15000,
      })
      .toBe(mainBranch)
    // The new branch still exists after switching away.
    expect(git(repoPath, 'branch', '--list', uiBranch)).toContain(uiBranch)
  })

  test('commits in the UI and pushes to the local bare remote', async () => {
    fs.writeFileSync(path.join(repoPath, 'pushed.txt'), 'to be pushed\n')
    await page.locator('#changes-tab').click()
    await expect(page.locator('.changes-list-container')).toContainText(
      'pushed.txt',
      { timeout: 20000 }
    )
    await page
      .getByRole('combobox', { name: 'Commit summary' })
      .fill(pushedSummary)
    await page.locator('[aria-label="Create commit"] .commit-button').click()
    await expect
      .poll(() => git(repoPath, 'log', '-1', '--pretty=%s'), {
        timeout: 20000,
      })
      .toBe(pushedSummary)

    const localHead = git(repoPath, 'rev-parse', 'HEAD')
    expect(git(bareDir, 'rev-parse', mainBranch)).not.toBe(localHead)

    const pushButton = page.locator('.push-pull-button button').first()
    await expect(pushButton).toContainText('Push origin', { timeout: 20000 })
    await pushButton.click()

    await expect
      .poll(() => git(bareDir, 'rev-parse', mainBranch), { timeout: 30000 })
      .toBe(localHead)
    expect(git(bareDir, 'log', '-1', '--pretty=%s', mainBranch)).toBe(
      pushedSummary
    )
  })

  test('fetches a commit pushed by another clone', async () => {
    git(otherClone, 'pull', '--ff-only')
    fs.writeFileSync(path.join(otherClone, 'upstream.txt'), 'from upstream\n')
    git(otherClone, 'add', 'upstream.txt')
    git(otherClone, 'commit', '-m', upstreamSummary)
    git(otherClone, 'push', 'origin', `HEAD:${mainBranch}`)
    const upstreamHead = git(otherClone, 'rev-parse', 'HEAD')

    const fetchButton = page.locator('.push-pull-button button').first()
    await expect(fetchButton).toContainText('Fetch origin', { timeout: 20000 })
    await fetchButton.click()

    await expect
      .poll(() => git(repoPath, 'rev-parse', `origin/${mainBranch}`), {
        timeout: 30000,
      })
      .toBe(upstreamHead)
    expect(
      git(repoPath, 'log', '-1', '--pretty=%s', `origin/${mainBranch}`)
    ).toBe(upstreamSummary)
    // Fetch must not touch the checked-out branch.
    expect(git(repoPath, 'log', '-1', '--pretty=%s')).toBe(pushedSummary)

    // The fetched commit shows up (as incoming) after Desktop refreshes.
    await expect(
      page.locator('.push-pull-button button').first()
    ).toContainText('Pull origin', { timeout: 20000 })
  })
})
