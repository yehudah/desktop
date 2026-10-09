import { join, resolve } from 'path'
import { existsSync } from 'fs'
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
