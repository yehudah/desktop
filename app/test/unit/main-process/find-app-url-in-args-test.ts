import { describe, it } from 'node:test'
import assert from 'node:assert'
import { findAppURLInArgs } from '../../../src/main-process/find-app-url-in-args'
import { parseAppURL, IOAuthAction } from '../../../src/lib/parse-app-url'

const protocols = new Set(['x-github-client', 'x-github-desktop-dev-auth'])
const exe = '/usr/lib/github-desktop/github-desktop'

describe('findAppURLInArgs', () => {
  it('finds the url in cold start argv', () => {
    const url = 'x-github-client://openRepo/https://github.com/desktop/desktop'
    assert.equal(findAppURLInArgs([exe, url], protocols), url)
  })

  it('finds the auth url in second-instance argv with Chromium switches', () => {
    const url = 'x-github-desktop-dev-auth://oauth?code=123&state=abc'
    const args = [exe, '--no-sandbox', '--enable-crashpad', url]
    assert.equal(findAppURLInArgs(args, protocols), url)

    const action = parseAppURL(findAppURLInArgs(args, protocols)!)
    assert.equal(action.name, 'oauth')
    assert.equal((action as IOAuthAction).code, '123')
  })

  it('returns percent-encoded urls unchanged', () => {
    const url =
      'x-github-client://openRepo/https%3A%2F%2Fgithub.com%2Fdesktop%2Fdesktop?branch=my%20branch'
    assert.equal(findAppURLInArgs([exe, url], protocols), url)
  })

  it('strips surrounding quotes', () => {
    const url = 'x-github-client://oauth?code=1&state=2'
    assert.equal(findAppURLInArgs([exe, `"${url}"`], protocols), url)
    assert.equal(findAppURLInArgs([exe, `'${url}'`], protocols), url)
  })

  it('matches the scheme case-insensitively', () => {
    const url = 'X-GitHub-Client://oauth?code=1&state=2'
    assert.equal(findAppURLInArgs([exe, url], protocols), url)
  })

  it('ignores schemes that are not registered', () => {
    const args = [
      exe,
      'x-github-desktop-auth://oauth?code=1',
      'github-mac://openRepo/https://github.com/desktop/desktop',
      'https://github.com/desktop/desktop',
      'file:///home/user/repo',
      'x-github-client-evil://oauth',
    ]
    assert.equal(findAppURLInArgs(args, protocols), null)
  })

  it('ignores ordinary path and cli arguments', () => {
    assert.equal(
      findAppURLInArgs([exe, '--cli-open', '/home/user/repo'], protocols),
      null
    )
    assert.equal(
      findAppURLInArgs(
        [exe, '--cli-open=/home/user/x-github-client'],
        protocols
      ),
      null
    )
    assert.equal(
      findAppURLInArgs(
        [exe, '--cli-clone', 'https://github.com/desktop/desktop'],
        protocols
      ),
      null
    )
    assert.equal(findAppURLInArgs([exe], protocols), null)
  })

  it('ignores switches that embed a url', () => {
    assert.equal(
      findAppURLInArgs(
        [exe, '--cli-open=x-github-client://oauth?code=1'],
        protocols
      ),
      null
    )
  })

  it('returns the first matching url', () => {
    const first = 'x-github-client://oauth?code=1&state=2'
    const second = 'x-github-client://oauth?code=3&state=4'
    assert.equal(findAppURLInArgs([exe, first, second], protocols), first)
  })
})
