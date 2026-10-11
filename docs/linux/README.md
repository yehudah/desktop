# GitHub Desktop on Linux (unofficial port)

This branch (`linux`) builds GitHub Desktop 3.6.6 for 64-bit Linux (x86_64 / amd64) as a `.deb` package and an AppImage. It is not an official GitHub release and is not signed or auto-updated.

Supported and tested: Ubuntu 22.04, Ubuntu 24.04 and Debian 12. Other distributions may work.

## Install

### .deb (recommended)

```shell
sudo apt install ./GitHubDesktop-linux-amd64-<version>.deb
github-desktop
```

`apt` pulls in the required libraries. Two packages are not dependencies but you will want them:

- A Secret Service provider (for example `gnome-keyring`, or KeePassXC with Secret Service enabled). Without one, GitHub Desktop cannot store your sign-in token.
- `desktop-file-utils`, so the `x-github-client://` sign-in callback is registered in the MIME cache (present on any regular desktop install).

The package installs to `/usr/lib/github-desktop` and puts `github-desktop` in `/usr/bin`. On Ubuntu 24.04 (AppArmor 4) the `apparmor` package already ships a profile that allows the app to use user namespaces at exactly this path, so the Chromium sandbox works (Ubuntu 22.04 and Debian 12 need no profile); do not move the install location.

### AppImage

```shell
chmod +x GitHubDesktop-linux-x86_64-<version>.AppImage
./GitHubDesktop-linux-x86_64-<version>.AppImage
```

Requirements: FUSE 2 (`sudo apt install libfuse2`, or `libfuse2t64` on Ubuntu 24.04) and the usual Electron desktop libraries on the host (GTK 3, NSS, libnotify, libsecret, libgbm, libdrm, libatspi, libxcb-dri3, xdg-utils, ALSA); an AppImage does not bundle them. `libcurl4` is also needed for the bundled git to use HTTPS. Without FUSE you can run `./GitHubDesktop-*.AppImage --appimage-extract-and-run`.

Check downloads against the `.sha256` files next to them: `sha256sum -c GitHubDesktop-linux-*.sha256`.

## Signing in with the AppImage

Signing in opens your browser, and GitHub redirects back to `x-github-client://...`. The operating system must know which program handles that scheme. The `.deb` registers it for you. A bare AppImage does not, so the browser redirect does nothing.

To make sign-in work with the AppImage, integrate it with the desktop:

1. Use an integration tool such as AppImageLauncher or Gear Lever and let it integrate the AppImage. This installs a launcher with the `x-scheme-handler/x-github-client` MIME type. Keep the AppImage at the location the tool chose; moving it breaks the launcher.
2. Alternatively write a launcher by hand at `~/.local/share/applications/github-desktop-appimage.desktop`, pointing `Exec` at the AppImage with `%U` and listing the schemes in `MimeType` (builds without OAuth credentials, like these, use `x-github-desktop-dev-auth`; builds with credentials use `x-github-desktop-auth`; check `grep MimeType /usr/share/applications/github-desktop.desktop` on a machine with the `.deb`):

   ```ini
   [Desktop Entry]
   Type=Application
   Name=GitHub Desktop
   Exec=/home/you/Applications/GitHubDesktop-linux-x86_64-<version>.AppImage --no-sandbox %U
   Terminal=false
   Categories=Development;RevisionControl;
   MimeType=x-scheme-handler/x-github-client;x-scheme-handler/x-github-desktop-dev-auth;
   ```

   then run `update-desktop-database ~/.local/share/applications` and `xdg-mime default github-desktop-appimage.desktop x-scheme-handler/x-github-client`.

If you cannot do this, use the `.deb`. The AppImage handler path was only checked by launching it, not by a full sign-in.

## Known limitations

- Not an official build: no code signing and no auto-update; the About dialog update check does not apply. Install new versions manually.
- Only x86_64. No arm64, `.rpm`, Flatpak or Snap packages.
- No default OAuth app of your own: builds without `DESKTOP_OAUTH_CLIENT_ID`/`DESKTOP_OAUTH_CLIENT_SECRET` use the development OAuth client embedded in the source (`app/app-info.ts`). The browser sign-in shows the development application's name and callback scheme.
- Credential storage needs a running, unlocked Secret Service (see above). If it is missing or locked, saving credentials fails and a stored token can look like "not signed in".
- The AppImage cannot use the Chromium sandbox on Ubuntu 24.04 (restricted user namespaces and no AppArmor profile for an AppImage mount path), so it runs with `--no-sandbox` there. The `.deb` runs sandboxed. The main window renderer runs without the Chromium sandbox on all platforms by upstream design (`nodeIntegration`).
- The bundled git requires glibc 2.34 or newer, so Ubuntu 20.04 and Debian 11 are not supported.
- AppImage-only libraries `libappindicator`, `libgconf-2` and `libindicator` have unresolved dependencies on a bare host; they are used for the tray only.
- `x-github-client://` links open GitHub Desktop through `xdg-open`. When another application already is the default for this scheme, GitHub Desktop keeps that default; if none is set, it registers itself.
- In Docker, the Chromium sandbox needs `--security-opt seccomp=unconfined` (or `--cap-add SYS_ADMIN`). The automated container tests use `--no-sandbox`.

## Building

All commands run on Linux (the repository's `script/linux/run.sh` runs them in Docker on other hosts):

```shell
yarn
yarn build:prod
yarn run package       # dist/GitHubDesktop-linux-amd64-<version>.deb and ...x86_64-<version>.AppImage, plus .sha256 files
```

CI (`.github/workflows/ci-linux.yml`) does this on Ubuntu 22.04 and 24.04 runners for pushes and pull requests to `linux`, runs the unit and E2E tests under xvfb against the installed `.deb`, checks a natively sandboxed launch and a FUSE AppImage launch, and on tags matching `release-*-linux*` creates a draft release.

## Following upstream releases

`linux` is upstream's code plus the Linux changes; `development` mirrors desktop/desktop and gets no commits of its own. `.github/workflows/upstream-sync.yml` runs daily (or by hand from the Actions tab): it fast-forwards `development` to upstream and, when upstream has a newer `release-X.Y.Z` tag than `linux` contains, opens a PR from `upstream-sync/release-X.Y.Z` into `linux`. A clean merge gets CI (Linux port) on the PR; a conflicting one is opened with the conflicting files listed and the commands to resolve it. The workflow never resolves conflicts or merges; merge the PR yourself, with a merge commit, after CI passes.

It needs a repository secret `UPSTREAM_SYNC_TOKEN`: a fine-grained personal access token for this repository only, with **Contents**, **Pull requests** and **Workflows** set to read and write. `GITHUB_TOKEN` cannot be used, because it cannot push upstream commits that change `.github/workflows`, and PRs it opens do not trigger CI.

Container-based checks live in `script/linux/test/` (installed `.deb` E2E, AppImage payload E2E, protocol handler, keytar, sandbox, package lifecycle). They need the built `dist/` artifacts and Docker.

## Running the sign-in test

Sign-in cannot be automated (it needs your GitHub account and a browser). To check it by hand with the `.deb`:

1. Install the `.deb` and a Secret Service provider, and log in to a normal desktop session (so `xdg-open` and the keyring work).
2. Start GitHub Desktop and choose **Sign in to GitHub.com**. Your browser opens the GitHub authorization page.
3. Approve it. The browser asks to open `github-desktop` (an `x-github-client://` link); allow it.
4. GitHub Desktop should show your account, and cloning a private repository over HTTPS should work.
5. Restart the app: you should still be signed in (the token came back from the Secret Service).

If the browser step does nothing, check the handler:

```shell
xdg-mime query default x-scheme-handler/x-github-client   # expect github-desktop.desktop
xdg-open 'x-github-client://openRepo/https://github.com/desktop/desktop'   # opens the Clone dialog
```

For AppImage users: do the same after integrating it as described above, and check that `xdg-mime` reports your AppImage launcher instead.
