import { basename, join, resolve } from 'path'
import { createHash } from 'crypto'
import { closeSync, existsSync, openSync, readSync, writeFileSync } from 'fs'
import { getReplacements } from '../app/app-info'
import { getProductName, getVersion } from '../app/package-info'
import {
  getDistArchitecture,
  getDistPath,
  getDistRoot,
  getExecutableName,
} from './dist-info'

const projectRoot = resolve(__dirname, '..')
const iconPath = join(projectRoot, 'app', 'static', 'linux', 'icon-logo.png')
const debianScripts = {
  postinst: join(
    projectRoot,
    'script',
    'resources',
    'linux',
    'deb',
    'postinst'
  ),
  postrm: join(projectRoot, 'script', 'resources', 'linux', 'deb', 'postrm'),
}

/**
 * The URL handlers registered in the desktop file. Mirrors possibleProtocols
 * in app/src/main-process/main.ts: the auth scheme depends on __DEV_SECRETS__.
 */
export function getDebianMimeTypes(devSecrets: boolean) {
  return [
    'x-scheme-handler/x-github-client',
    devSecrets
      ? 'x-scheme-handler/x-github-desktop-dev-auth'
      : 'x-scheme-handler/x-github-desktop-auth',
  ]
}

export interface IDebianInstallerParams {
  readonly src: string
  readonly dest: string
  readonly debPath: string
  readonly arch: 'amd64' | 'arm64'
  readonly bin: string
  readonly productName: string
  readonly devSecrets: boolean
}

/**
 * The electron-installer-debian options. The desktop file, MIME types, icon
 * and /usr/bin symlink are all generated from these.
 */
export function getDebianInstallerOptions(p: IDebianInstallerParams) {
  return {
    src: p.src,
    dest: p.dest,
    rename: () => p.debPath,
    arch: p.arch,
    name: 'github-desktop',
    productName: p.productName,
    bin: p.bin,
    genericName: 'Git Client',
    description: 'Simple collaboration from your desktop',
    productDescription:
      'GitHub Desktop is an application that lets you interact with\n' +
      'GitHub and Git repositories from a graphical interface.',
    section: 'devel',
    priority: 'optional',
    homepage: 'https://desktop.github.com/',
    categories: ['Development', 'RevisionControl'],
    mimeType: getDebianMimeTypes(p.devSecrets),
    maintainer: 'GitHub Desktop <opensource+desktop@github.com>',
    icon: { '512x512': iconPath },
    scripts: debianScripts,
  }
}

export function getDebianPackagePath() {
  const arch = getDistArchitecture() === 'arm64' ? 'arm64' : 'amd64'
  return join(getDistRoot(), `GitHubDesktop-linux-${arch}-${getVersion()}.deb`)
}

/** Builds the .deb from the staged dist/github-desktop-linux-<arch> payload. */
export async function packageDebian(): Promise<string> {
  for (const f of [iconPath, ...Object.values(debianScripts)]) {
    if (!existsSync(f)) {
      throw new Error(`Expected ${f} to exist`)
    }
  }

  const dest = getDebianPackagePath()

  // electron-installer-debian is ESM-only; Node's require(esm) handles it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const createInstaller = require('electron-installer-debian').default

  await createInstaller(
    getDebianInstallerOptions({
      src: getDistPath(),
      dest: getDistRoot(),
      debPath: dest,
      arch: getDistArchitecture() === 'arm64' ? 'arm64' : 'amd64',
      bin: getExecutableName(),
      productName: getProductName(),
      devSecrets: getReplacements().__DEV_SECRETS__,
    })
  )

  return dest
}

export interface IAppImageParams {
  readonly version: string
  readonly productName: string
  readonly executableName: string
  readonly output: string
  readonly devSecrets: boolean
}

/** electron-builder configuration for an AppImage of a prepackaged payload. */
export function getAppImageBuilderConfig(p: IAppImageParams) {
  return {
    appId: 'com.github.GitHubClient',
    productName: p.productName,
    artifactName: `GitHubDesktop-linux-x86_64-${p.version}.\${ext}`,
    npmRebuild: false,
    publish: null,
    directories: { output: p.output },
    linux: {
      target: ['AppImage'],
      category: 'Development',
      executableName: p.executableName,
      mimeTypes: getDebianMimeTypes(p.devSecrets),
      icon: iconPath,
    },
  }
}

export function getAppImagePackagePath(output: string, version: string) {
  return join(output, `GitHubDesktop-linux-x86_64-${version}.AppImage`)
}

/** Builds the AppImage from the same staged payload the .deb is built from. */
export async function packageAppImage(): Promise<string> {
  const version = getVersion()
  const output = getDistRoot()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { build, Platform, Arch } = require('electron-builder')

  await build({
    targets: Platform.LINUX.createTarget('appimage', Arch.x64),
    prepackaged: getDistPath(),
    publish: 'never',
    config: getAppImageBuilderConfig({
      version,
      productName: getProductName(),
      executableName: getExecutableName(),
      output,
      devSecrets: getReplacements().__DEV_SECRETS__,
    }),
  })

  const dest = getAppImagePackagePath(output, version)
  if (!existsSync(dest)) {
    throw new Error(`Expected ${dest} to exist`)
  }
  return dest
}

/** Writes `<file>.sha256` in `sha256sum` format and returns its path. */
export function writeSha256File(file: string): string {
  const sha = createHash('sha256')
  const fd = openSync(file, 'r')
  try {
    const buf = Buffer.alloc(1024 * 1024)
    let n: number
    while ((n = readSync(fd, buf, 0, buf.length, null)) > 0) {
      sha.update(buf.subarray(0, n))
    }
  } finally {
    closeSync(fd)
  }
  const hash = sha.digest('hex')
  const out = `${file}.sha256`
  writeFileSync(out, `${hash}  ${basename(file)}\n`)
  return out
}
