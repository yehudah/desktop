import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import { basename, join } from 'path'
import {
  getDistPath,
  getExecutableName,
  getExtraResources,
  getIconDirectory,
} from '../../dist-info'

const originalPlatform = process.platform
const originalNodeEnv = process.env.NODE_ENV

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform })
}

afterEach(() => {
  setPlatform(originalPlatform)
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = originalNodeEnv
  }
})

describe('getExecutableName on Linux', () => {
  it('is github-desktop in production', () => {
    setPlatform('linux')
    process.env.NODE_ENV = 'production'
    assert.equal(getExecutableName(), 'github-desktop')
  })

  it('is github-desktop-dev in development', () => {
    setPlatform('linux')
    process.env.NODE_ENV = 'development'
    assert.equal(getExecutableName(), 'github-desktop-dev')
  })

  it('names the dist dir after the executable', () => {
    setPlatform('linux')
    process.env.NODE_ENV = 'production'
    assert.match(basename(getDistPath()), /^github-desktop-linux-[^-]+$/)
  })
})

describe('getExtraResources', () => {
  it('bundles Assets.car on macOS', () => {
    setPlatform('darwin')
    assert.deepStrictEqual(getExtraResources(), [
      join(getIconDirectory(), 'Assets.car'),
    ])
  })

  it('bundles nothing extra on Linux', () => {
    setPlatform('linux')
    assert.deepStrictEqual(getExtraResources(), [])
  })
})
