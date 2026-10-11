# GitHub Desktop on Linux (unofficial port)

This branch (`linux`) builds the current upstream GitHub Desktop release for 64-bit Linux (x86_64 / amd64) as a `.deb` package and an AppImage. It is not an official GitHub release and is not signed or auto-updated.

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

`linux` is upstream's code plus the Linux changes; `development` tracks
`desktop/desktop` and gets no commits of its own. The upstream sync workflow runs
daily at 06:17 UTC and supports manual dispatch. It fast-forwards `development`
only when its current tip is an ancestor of upstream's tip. Divergence fails with
an error; it never force-pushes or discards commits.

The latest stable `release-X.Y.Z` tag is proposed if its commit is not already an
ancestor of `linux`. Beta/test and Linux-specific tags are excluded. Clean merges
are prepared automatically on `upstream-sync/release-X.Y.Z`, with both histories
preserved, and a PR targets `linux`. Upstream workflow changes are included and
must be reviewed alongside Linux functionality. Conflicts produce an upstream-only
branch and a PR listing the files and resolution commands; no conflict is silently
resolved. The workflow never merges a PR. After Linux CI passes, use **Create a
merge commit**, not squash/rebase: release ancestry prevents repeated proposals.

### One-time GitHub App setup

1. As `yehudah`, open [Settings → Developer settings → GitHub Apps → New GitHub
   App](https://github.com/settings/apps/new). Choose a unique name, such as
   `yehudah-desktop-upstream-sync`, and use `https://github.com/yehudah/desktop` as
   the homepage. Leave callback/setup URLs empty and user authorization options
   unchecked. Uncheck **Active** under **Webhook**; this scheduled workflow does
   not need webhooks or event subscriptions. Select **Only on this account** for
   where the App can be installed.
2. Under **Repository permissions**, grant **Contents: Read and write**, **Pull
   requests: Read and write**, and **Workflows: Read and write** (the token API
   represents Workflows as `write`). **Metadata: Read-only** is automatically
   required. Leave every other repository, organization, and account permission
   at **No access**. Workflows permission is necessary to push commits modifying
   `.github/workflows`; Actions write is not needed to trigger PR CI. See
   [GitHub's App permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps).
3. Create the App, then open **Install App**, choose `yehudah`, select **Only select
   repositories**, select **desktop**, and install. Do not choose all repositories.
4. On the App's **General** page, record its **Client ID** (not its client secret or
   installation ID). Under **Private keys**, click **Generate a private key**.
   GitHub downloads a PEM file. Keep it outside the repository, restrict access
   (`chmod 600 /path/to/downloaded-key.pem`), and keep any backup in a secure
   credential store. Never paste the key into chat or commit it.
5. In [desktop → Settings → Secrets and variables → Actions](https://github.com/yehudah/desktop/settings/secrets/actions),
   add repository **variable** `UPSTREAM_SYNC_APP_CLIENT_ID` with the Client ID and
   repository **secret** `UPSTREAM_SYNC_APP_PRIVATE_KEY` with the entire PEM,
   including its BEGIN/END lines. Alternatively, upload it directly from the local
   file without displaying it:

   ```shell
   gh variable set UPSTREAM_SYNC_APP_CLIENT_ID --repo yehudah/desktop --body '<Client ID>'
   gh secret set UPSTREAM_SYNC_APP_PRIVATE_KEY --repo yehudah/desktop < /path/to/downloaded-key.pem
   ```

   No PAT, client secret, installation ID, or upstream installation is required.
   Once this workflow is adopted, remove/revoke any obsolete `UPSTREAM_SYNC_TOKEN`
   previously used solely for synchronization.
6. After this PR is merged into the default `linux` branch, open **Actions →
   Upstream release sync → Run workflow** on `linux`. Check the App-token step,
   `development` update, and generated PR. Require an actual successful run before
   treating authentication as verified. Branch rules must permit the App's normal
   fast-forward push to `development` and creation of `upstream-sync/*`; failures
   remain errors, and the workflow does not bypass or change repository rules.

The official
[`actions/create-github-app-token`](https://github.com/actions/create-github-app-token)
action is pinned to a commit, requests only the three write permissions above,
and explicitly scopes its installation token to `yehudah/desktop`. Tokens expire
within one hour and are revoked by the action at job completion. Checkout does not
persist credentials; Git reads the App token through a credential helper only in
sync steps. No upstream build scripts, dependency installs, submodules, or Git
hooks run with privileged credentials. Builds execute separately in Linux PR CI
with a read-only repository token and no App credentials.

### Conflict resolution and recovery

A conflicting PR cannot run `pull_request` CI until its conflicts are resolved.
Follow the PR's commands: check out its head branch, merge `origin/linux` into it,
resolve the listed files while preserving Linux behavior, commit, and push back
to the same head branch without force. This produces a descendant of both the
release and Linux tips. A maintainer-authenticated push (or App-token push)
triggers the PR's `synchronize` event; Linux CI listens for it on PRs targeting
`linux`. Pushes using `GITHUB_TOKEN` do not have the same triggering behavior. See
[GitHub's event rules](https://docs.github.com/en/actions/concepts/security/github_token).

Repeated runs leave an existing open sync PR and its branch untouched. If pushing
succeeded but PR creation failed, the next run reuses the branch, preserves any
maintainer commits, and retries PR creation. A branch with no PR that was deleted
is recreated. A closed/merged PR whose release is still absent produces an error
instead of another PR; reopen the original PR or incorporate the release manually
with a merge commit. An open PR with a missing branch also produces an error.

To restore a deleted head branch without losing the PR's commits, obtain them
from the PR ref, push them back, then reopen the PR if it was closed (replace the
number and release tag):

```shell
git fetch origin pull/<PR-number>/head
git push origin FETCH_HEAD:refs/heads/upstream-sync/release-X.Y.Z
gh pr reopen <PR-number> --repo yehudah/desktop
```

Do not reopen an already merged PR; if it was squashed/rebased, merge the upstream
tag into `linux` through a reviewed PR to restore the missing ancestry. If
`development` diverges, inspect both histories and reconcile them manually before
rerunning. The workflow never repairs divergence destructively. All failed steps
fail the run and provide setup/recovery guidance in its summary.

Container-based checks live in `script/linux/test/` (installed `.deb` E2E, AppImage payload E2E, protocol handler, keytar, sandbox, package lifecycle). They need the built `dist/` artifacts and Docker.

## Releases

Releases are tagged `release-X.Y.Z-linuxN`. `X.Y.Z` is the upstream version
in `app/package.json`. `N` starts at 1 for each upstream version and goes up for
Linux-only releases on the same base (3.6.7-linux1, 3.6.7-linux2, then
3.6.8-linux1). The .deb and AppImage are versioned `X.Y.Z-linuxN`, so apt treats
each Linux-only release as an upgrade. The app's About box still shows the
upstream version: `app/package.json` is never edited, which keeps upstream
merges clean.

- **After an upstream sync:** merging an `upstream-sync/release-X.Y.Z` PR runs
  **Tag Linux release**. It checks that `app/package.json` says `X.Y.Z` and
  tags the merge commit `release-X.Y.Z-linux1`.
- **Linux-only release:** merge the fixes into `linux`, then go to **Actions →
  Tag Linux release → Run workflow**. It tags the tip of `linux` with the next
  `N`. If the tip already has a Linux release tag, it does nothing.

The tag push runs **CI (Linux port)** on that tag: the full build and tests on
both runners, then a **draft** release with the ubuntu-22.04 artifacts (lowest
glibc), `.sha256` files and a link to the upstream release. Install the draft's
`.deb` and smoke-test it, then edit the release and click **Publish**. If the tag
build fails, fix it on `linux` and dispatch again; that gives a new `N`. Do not
move or reuse a tag.

The tagging workflow pushes the tag with the sync App's token, because a tag
pushed with `GITHUB_TOKEN` would not trigger CI. The tag logic is in
`script/linux/next-release-tag.sh`, and the version mapping is
`getLinuxPackageVersion` in `script/package-linux.ts`.

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
