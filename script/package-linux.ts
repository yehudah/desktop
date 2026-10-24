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

/**
 * The version the .deb and AppImage are published as.
 *
 * Release tags are release-<upstream version>-linux<N> (see
 * script/linux/next-release-tag.sh); a tag build passes the tag in
 * DESKTOP_LINUX_RELEASE_TAG. The package version must include N, or a
 * Linux-only release (linux2) has the same .deb version as linux1 and apt does
 * not upgrade to it. Untagged builds (PR CI, local) pass undefined.
 *
 * @param appVersion upstream's version from app/package.json, e.g. '3.6.7'
 * @param releaseTag e.g. 'release-3.6.7-linux2', or undefined/'' when untagged
 * @returns e.g. '3.6.7-linux2' for that tag, appVersion when untagged
 */
export function getLinuxPackageVersion(
  appVersion: string,
  releaseTag: string | undefined
): string {
  if (!releaseTag) {
    return appVersion
  }
  // Fail the tag build rather than publish a mislabeled package.
  const match = /^release-(\d+\.\d+\.\d+)-linux(\d+)$/.exec(releaseTag)
  if (match === null) {
    throw new Error(`Release tag ${releaseTag} is not release-X.Y.Z-linuxN`)
  }
  if (match[1] !== appVersion) {
    throw new Error(
      `Release tag ${releaseTag} does not match app version ${appVersion}`
    )
  }
  return `${appVersion}-linux${match[2]}`
}

function getPackageVersion() {
  return getLinuxPackageVersion(
    getVersion(),
    process.env.DESKTOP_LINUX_RELEASE_TAG
  )
}

export interface IDebianInstallerParams {
  readonly src: string
  readonly dest: string
  readonly debPath: string
  readonly arch: 'amd64' | 'arm64'
  readonly bin: string
  readonly productName: string
  readonly devSecrets: boolean
  readonly version: string
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
    version: p.version,
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
    // Added to electron-installer-debian's defaults. The bundled git needs
    // glibc 2.34 and its HTTPS remote helpers link against libcurl.so.4
    // (libcurl4t64 provides libcurl4 on Ubuntu 24.04).
    depends: ['libc6 (>= 2.34)', 'libcurl4'],
    maintainer: 'GitHub Desktop <opensource+desktop@github.com>',
    icon: { '512x512': iconPath },
    scripts: debianScripts,
  }
}

export function getDebianPackagePath() {
  const arch = getDistArchitecture() === 'arm64' ? 'arm64' : 'amd64'
  return join(
    getDistRoot(),
    `GitHubDesktop-linux-${arch}-${getPackageVersion()}.deb`
  )
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
      version: getPackageVersion(),
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
  const version = getPackageVersion()
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
