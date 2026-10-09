import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getDebianInstallerOptions,
  getAppImageBuilderConfig,
  getAppImagePackagePath,
  getDebianMimeTypes,
  IAppImageParams,
  IDebianInstallerParams,
  writeSha256File,
} from '../../package-linux'

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

  // main.ts builds possibleProtocols inline from __DEV_SECRETS__ and cannot be
  // imported here, so this fixture mirrors that block:
  //   new Set(['x-github-client']); add dev-auth if __DEV_SECRETS__ else auth
  // (the Windows/macOS-only legacy schemes are irrelevant on Linux).
  const mainTsProtocols = (devSecrets: boolean) => [
    'x-github-client',
    devSecrets ? 'x-github-desktop-dev-auth' : 'x-github-desktop-auth',
  ]

  for (const devSecrets of [true, false]) {
    it(`matches possibleProtocols in main.ts (__DEV_SECRETS__=${devSecrets})`, () => {
      const schemes = getDebianMimeTypes(devSecrets).map(m =>
        m.replace('x-scheme-handler/', '')
      )
      assert.deepStrictEqual(schemes, mainTsProtocols(devSecrets))
    })
  }

  it('fixture still mirrors the possibleProtocols block in main.ts', () => {
    const main = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'app',
        'src',
        'main-process',
        'main.ts'
      ),
      'utf8'
    )
    assert.match(main, /new Set\(\['x-github-client'\]\)/)
    assert.match(
      main,
      /if \(__DEV_SECRETS__\) \{\s*possibleProtocols\.add\('x-github-desktop-dev-auth'\)\s*\} else \{\s*possibleProtocols\.add\('x-github-desktop-auth'\)/
    )
  })
})

const params: IDebianInstallerParams = {
  src: '/dist/github-desktop-linux-x64',
  dest: '/dist',
  debPath: '/dist/GitHubDesktop-linux-amd64-1.2.3.deb',
  arch: 'amd64',
  bin: 'github-desktop',
  productName: 'GitHub Desktop',
  devSecrets: true,
}

describe('getDebianInstallerOptions', () => {
  const options = getDebianInstallerOptions(params)

  it('passes the paths, arch and rename through', () => {
    assert.strictEqual(options.src, params.src)
    assert.strictEqual(options.dest, params.dest)
    assert.strictEqual(options.arch, 'amd64')
    assert.strictEqual(options.rename(), params.debPath)
  })

  it('uses the requested arch', () => {
    assert.strictEqual(
      getDebianInstallerOptions({ ...params, arch: 'arm64' }).arch,
      'arm64'
    )
  })

  it('names the package and binary github-desktop', () => {
    assert.strictEqual(options.name, 'github-desktop')
    assert.strictEqual(options.bin, 'github-desktop')
    assert.strictEqual(options.productName, 'GitHub Desktop')
  })

  it('derives mimeType from the secrets flag', () => {
    assert.deepStrictEqual(options.mimeType, getDebianMimeTypes(true))
    assert.deepStrictEqual(
      getDebianInstallerOptions({ ...params, devSecrets: false }).mimeType,
      getDebianMimeTypes(false)
    )
  })

  it('sets the control file metadata', () => {
    assert.strictEqual(options.section, 'devel')
    assert.strictEqual(options.priority, 'optional')
    assert.strictEqual(
      options.maintainer,
      'GitHub Desktop <opensource+desktop@github.com>'
    )
    assert.strictEqual(options.homepage, 'https://desktop.github.com/')
    assert.deepStrictEqual(options.categories, [
      'Development',
      'RevisionControl',
    ])
  })

  it('points at an icon and postinst/postrm scripts', () => {
    assert.match(options.icon['512x512'], /app\/static\/linux\/icon-logo\.png$/)
    assert.match(options.scripts.postinst, /resources\/linux\/deb\/postinst$/)
    assert.match(options.scripts.postrm, /resources\/linux\/deb\/postrm$/)
    for (const f of [
      options.icon['512x512'],
      ...Object.values(options.scripts),
    ]) {
      assert.ok(existsSync(f), `${f} should exist`)
    }
  })
})

describe('electron-installer-debian output for our options', () => {
  let tmp: string
  let installer: any

  before(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'deb-test-'))
    const src = join(tmp, 'src')
    mkdirSync(join(src, 'resources', 'app'), { recursive: true })
    writeFileSync(join(src, 'version'), 'v39.0.0\n')
    writeFileSync(
      join(src, 'resources', 'app', 'package.json'),
      JSON.stringify({ name: 'github-desktop', version: '1.2.3' })
    )

    // tsx's require hook transpiles the ESM-only package to CJS, where
    // import.meta.dirname is undefined; a real import() keeps it native.
    const importEsm = new Function('m', 'return import(m)')
    const { Installer } = await importEsm('electron-installer-debian')
    installer = new Installer({
      ...getDebianInstallerOptions({ ...params, src, dest: tmp }),
      logger: () => {},
    })
    await installer.generateDefaults()
    installer.generateOptions()
    await installer.createStagingDir()
  })

  after(() => rmSync(tmp, { recursive: true, force: true }))

  it('depends on libsecret-1-0', () => {
    assert.ok(
      installer.options.depends.includes('libsecret-1-0'),
      `depends: ${installer.options.depends}`
    )
  })

  it('generates the desktop entry identity', async () => {
    await installer.createDesktopFile()
    const desktop = readFileSync(
      join(
        installer.stagingDir,
        'usr',
        'share',
        'applications',
        'github-desktop.desktop'
      ),
      'utf8'
    )
    assert.match(desktop, /^Name=GitHub Desktop$/m)
    assert.match(desktop, /^StartupWMClass=GitHub Desktop$/m)
    assert.match(desktop, /^Exec=github-desktop %U$/m)
    assert.match(desktop, /^Icon=github-desktop$/m)
    assert.match(
      desktop,
      /^MimeType=x-scheme-handler\/x-github-client;x-scheme-handler\/x-github-desktop-dev-auth;$/m
    )
  })

  it('writes Depends with libsecret-1-0 into the control file', async () => {
    mkdirSync(join(installer.stagingDir, 'DEBIAN'), { recursive: true })
    await installer.createControl()
    const control = readFileSync(
      join(installer.stagingDir, 'DEBIAN', 'control'),
      'utf8'
    )
    assert.match(control, /^Package: github-desktop$/m)
    assert.match(control, /^Depends: .*libsecret-1-0/m)
  })
})

describe('getAppImageBuilderConfig', () => {
  const p: IAppImageParams = {
    version: '1.2.3',
    productName: 'GitHub Desktop',
    executableName: 'github-desktop',
    output: '/dist',
    devSecrets: false,
  }
  const config = getAppImageBuilderConfig(p)

  it('builds only an AppImage without rebuilding native modules', () => {
    assert.deepStrictEqual(config.linux.target, ['AppImage'])
    assert.strictEqual(config.npmRebuild, false)
    assert.strictEqual(config.directories.output, '/dist')
  })

  it('names the artifact GitHubDesktop-linux-x86_64-<version>.AppImage', () => {
    assert.strictEqual(
      config.artifactName,
      'GitHubDesktop-linux-x86_64-1.2.3.${ext}'
    )
    assert.strictEqual(
      getAppImagePackagePath('/dist', '1.2.3'),
      '/dist/GitHubDesktop-linux-x86_64-1.2.3.AppImage'
    )
  })

  it('shares the .deb MIME types and executable name', () => {
    assert.deepStrictEqual(config.linux.mimeTypes, getDebianMimeTypes(false))
    assert.strictEqual(config.linux.executableName, 'github-desktop')
    assert.deepStrictEqual(
      getAppImageBuilderConfig({ ...p, devSecrets: true }).linux.mimeTypes,
      getDebianMimeTypes(true)
    )
  })

  it('does not publish', () => {
    assert.strictEqual(config.publish, null)
  })
})

describe('writeSha256File', () => {
  let dir: string
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'sha256-test-'))
  })
  after(() => rmSync(dir, { recursive: true, force: true }))

  it('writes "<hex>  <basename>" next to the artifact', () => {
    const f = join(dir, 'a.bin')
    writeFileSync(f, 'hello')
    const out = writeSha256File(f)
    assert.strictEqual(out, `${f}.sha256`)
    assert.strictEqual(
      readFileSync(out, 'utf8'),
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  a.bin\n'
    )
  })
})
