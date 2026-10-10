// Run with ELECTRON_RUN_AS_NODE=1 <installed binary> check-keytar.js <keytar.node>.
// Exercises the bundled keytar.node under the service names Desktop uses (app/src/lib/auth.ts
// getKeyForEndpoint: 'GitHub - <endpoint>', 'GitHub Desktop Dev - <endpoint>').
// mode=roundtrip (default) exits 0 iff set/get/delete work; mode=report prints the error and exits 0.
const assert = require('assert')
const keytar = require(process.argv[2])
const mode = process.argv[3] || 'roundtrip'

const cases = [
  ['GitHub - https://api.github.com', 'octocat'],
  ['GitHub - https://ghe.example.com/api/v3', 'someone'],
  ['GitHub Desktop Dev - https://api.github.com', 'octocat'],
]

async function roundtrip() {
  for (const [service, account] of cases) {
    const secret = `ghp_test_${Date.now()}`
    assert.strictEqual(await keytar.getPassword(service, account), null, 'precondition: absent')
    await keytar.setPassword(service, account, secret)
    assert.strictEqual(await keytar.getPassword(service, account), secret, 'get after set')
    assert.strictEqual(await keytar.deletePassword(service, account), true, 'delete returns true')
    assert.strictEqual(await keytar.getPassword(service, account), null, 'absent after delete')
    assert.strictEqual(await keytar.deletePassword(service, account), false, 'second delete false')
    console.log(`ok: ${service} / ${account}`)
  }
}

async function report() {
  const [service, account] = cases[0]
  for (const [name, fn] of [
    ['setPassword', () => keytar.setPassword(service, account, 'x')],
    ['getPassword', () => keytar.getPassword(service, account)],
    ['deletePassword', () => keytar.deletePassword(service, account)],
  ]) {
    try {
      console.log(`${name}: resolved with`, JSON.stringify(await fn()))
    } catch (e) {
      console.log(`${name}: rejected: ${e && e.message}`)
    }
  }
}

;(mode === 'report' ? report() : roundtrip()).catch(e => {
  console.error('FAIL:', e && e.stack)
  process.exit(1)
})
