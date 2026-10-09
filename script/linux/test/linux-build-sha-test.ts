import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeLinuxBuildSha } from '../../linux-build-sha'

const sha = '4afcfa561d930562b555e27b8bda228a7ac369e9'

describe('linux-build-sha stamping', () => {
  it('writes the SHA followed by a single newline', () => {
    const appPath = mkdtempSync(join(tmpdir(), 'sha-test-'))
    try {
      mkdirSync(join(appPath, 'resources', 'app'), { recursive: true })
      writeLinuxBuildSha(appPath, sha)
      assert.strictEqual(
        readFileSync(
          join(appPath, 'resources', 'app', 'linux-build-sha'),
          'utf8'
        ),
        `${sha}\n`
      )
    } finally {
      rmSync(appPath, { recursive: true, force: true })
    }
  })
})
