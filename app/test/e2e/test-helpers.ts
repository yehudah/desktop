/* eslint-disable no-sync */

import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const smokeRepoPath = path.join(
  os.tmpdir(),
  'github-desktop-e2e-smoke-repository'
)
export const smokeRepoName = path.basename(smokeRepoPath)
export const smokeRepoFileName = 'smoke-change.txt'
export const smokeRepoFileContents =
  'This file should appear in the changes list.'

export function ensureSmokeTestRepository() {
  fs.rmSync(smokeRepoPath, { recursive: true, force: true })
  fs.mkdirSync(smokeRepoPath, { recursive: true })

  runGit(['init'], smokeRepoPath)
  runGit(['config', 'user.name', 'GitHub Desktop E2E'], smokeRepoPath)
  runGit(['config', 'user.email', 'desktop-e2e@example.com'], smokeRepoPath)

  fs.writeFileSync(
    path.join(smokeRepoPath, 'README.md'),
    '# GitHub Desktop Smoke Repo\n'
  )

  runGit(['add', 'README.md'], smokeRepoPath)
  runGit(['commit', '-m', 'Initial commit'], smokeRepoPath)

  fs.writeFileSync(
    path.join(smokeRepoPath, smokeRepoFileName),
    `${smokeRepoFileContents}\n`
  )
}

function runGit(args: ReadonlyArray<string>, cwd: string) {
  execFileSync('git', [...args], {
    cwd,
    stdio: 'ignore',
    // Keep host git config (gpgsign, templates, hooks) out of fixture setup.
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_SYSTEM: os.devNull,
    },
  })
}

function readGitOutput(args: ReadonlyArray<string>, cwd: string) {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

export function getSmokeRepoStatus() {
  return readGitOutput(['status', '--short'], smokeRepoPath)
}

export function getSmokeRepoHeadMessage() {
  return readGitOutput(['log', '-1', '--pretty=%s'], smokeRepoPath)
}

export function getSmokeRepoCurrentBranch() {
  return readGitOutput(['branch', '--show-current'], smokeRepoPath)
}

export function createTempRepository(fileName: string, contents: string) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-e2e-repo-'))

  runGit(['init'], repoPath)
  runGit(['config', 'user.name', 'GitHub Desktop E2E'], repoPath)
  runGit(['config', 'user.email', 'desktop-e2e@example.com'], repoPath)
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# Functional repo\n')
  runGit(['add', 'README.md'], repoPath)
  runGit(['commit', '-m', 'Initial commit'], repoPath)

  // Modify a tracked file and add an untracked one so Changes has two entries.
  fs.appendFileSync(path.join(repoPath, 'README.md'), 'modified line\n')
  fs.writeFileSync(path.join(repoPath, fileName), contents)

  return repoPath
}

export function gitInRepo(repoPath: string, ...args: ReadonlyArray<string>) {
  return readGitOutput(args, repoPath)
}
