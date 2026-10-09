import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getDebianMimeTypes } from '../../package-linux'

describe('getDebianMimeTypes', () => {
  it('uses the dev auth scheme without OAuth secrets', () => {
    assert.deepStrictEqual(getDebianMimeTypes(true), [
      'x-scheme-handler/x-github-client',
      'x-scheme-handler/x-github-desktop-dev-auth',
    ])
  })

  it('uses the production auth scheme with OAuth secrets', () => {
    assert.deepStrictEqual(getDebianMimeTypes(false), [
      'x-scheme-handler/x-github-client',
      'x-scheme-handler/x-github-desktop-auth',
    ])
  })
})
