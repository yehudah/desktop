# GitHub Desktop for Linux (unofficial)

> [!IMPORTANT]
> **This is an unofficial, community-maintained port. It is not affiliated with,
> endorsed by, or supported by GitHub.** Please don't report problems with these
> builds to [`desktop/desktop`](https://github.com/desktop/desktop); file them
> in [this fork's issues](https://github.com/yehudah/desktop/issues) instead.

This fork builds [GitHub Desktop](https://github.com/desktop/desktop) for 64-bit
Linux, as a `.deb` package and an AppImage. The `linux` branch is upstream's code
plus a small set of Linux packaging and platform changes. It follows upstream's
stable releases: a daily workflow proposes each new `release-X.Y.Z` as a pull
request, and every release is built and tested in CI on Ubuntu 22.04 and 24.04.

## Download

Get the `.deb` (recommended) or the AppImage from
[Releases](https://github.com/yehudah/desktop/releases). Install and sign-in
instructions, requirements and known limitations are in
[docs/linux/README.md](docs/linux/README.md).

- **Tested on:** Ubuntu 22.04, Ubuntu 24.04 and Debian 12, x86_64 only. Other
  glibc 2.34+ distributions may work.
- **Versions:** `X.Y.Z-linuxN` means upstream release `X.Y.Z` plus Linux revision
  `N`. A higher `N` on the same upstream version means Linux-only fixes.
- **Updates:** there is no auto-update. Install new releases yourself; `apt`
  upgrades the `.deb` in place.
- **Verify downloads:** `sha256sum -c GitHubDesktop-linux-*.sha256`.

## Things to know

- **Not an official build.** The packages are not code-signed and have not been
  reviewed by GitHub. You run them at your own risk; the software is provided
  "as is", without warranty, under the [MIT license](LICENSE).
- **Sign-in uses GitHub Desktop's development OAuth app.** These builds don't
  include GitHub's production OAuth credentials, so the browser sign-in page
  shows the development application instead of "GitHub Desktop". Your token is
  stored in your desktop's keyring (Secret Service, e.g. GNOME Keyring or
  KeePassXC), which must be running and unlocked.
- **Behavior is upstream's.** Features, UI and bugs that aren't Linux-specific
  come from upstream. If something also happens on the official macOS or Windows
  app, it belongs upstream.
- **Trademarks.** "GitHub", "GitHub Desktop" and the GitHub logos are trademarks
  of GitHub, Inc. They are used here only to identify the software this port is
  built from. See the license section below.

## Credits

Based on [GitHub Desktop](https://github.com/desktop/desktop) by GitHub and its
contributors. Linux support builds on
[`shiftkey/desktop`](https://github.com/shiftkey/desktop), the long-running
community Linux fork, whose patches were ported to current upstream releases.

## Contributing to the Linux port

Linux-specific fixes go to the `linux` branch through pull requests; CI must
pass on both Ubuntu runners. Changes that aren't Linux-specific should go
[upstream](https://github.com/desktop/desktop/blob/development/.github/CONTRIBUTING.md)
first. Build instructions, the upstream sync and the release process are in
[docs/linux/README.md](docs/linux/README.md).

---

_The rest of this file is upstream's README, unchanged._

# [GitHub Desktop](https://desktop.github.com)

[GitHub Desktop](https://desktop.github.com/) is an open-source [Electron](https://www.electronjs.org/)-based
GitHub app. It is written in [TypeScript](https://www.typescriptlang.org) and
uses [React](https://reactjs.org/).

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="A screenshot of the GitHub Desktop application showing changes being viewed and committed with two attributed co-authors"
  />
</picture>

## Where can I get it?

Download the official installer for your operating system:

 - [macOS](https://central.github.com/deployments/desktop/desktop/latest/darwin)
 - [macOS (Apple silicon)](https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64)
 - [Windows](https://central.github.com/deployments/desktop/desktop/latest/win32)
 - [Windows machine-wide install](https://central.github.com/deployments/desktop/desktop/latest/win32?format=msi)

Linux is not officially supported; however, you can find installers created for Linux from a fork of GitHub Desktop in the [Community Releases](https://github.com/desktop/desktop#community-releases) section.

### Beta Channel

Want to test out new features and get fixes before everyone else? Install the
beta channel to get access to early builds of Desktop:

 - [macOS](https://central.github.com/deployments/desktop/desktop/latest/darwin?env=beta)
 - [macOS (Apple silicon)](https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64?env=beta)
 - [Windows](https://central.github.com/deployments/desktop/desktop/latest/win32?env=beta)
 - [Windows (ARM64)](https://central.github.com/deployments/desktop/desktop/latest/win32-arm64?env=beta)

The release notes for the latest beta versions are available [here](https://desktop.github.com/release-notes/?env=beta).

### Past Releases
You can find past releases at https://desktop.githubusercontent.com. After installation of a past version, the auto update functionality will attempt to download the latest version. 

### Community Releases

There are several community-supported package managers that can be used to
install GitHub Desktop:
 - Windows users can install using [winget](https://docs.microsoft.com/en-us/windows/package-manager/winget/) `c:\> winget install github-desktop` or [Chocolatey](https://chocolatey.org/) `c:\> choco install github-desktop`
 - macOS users can install using [Homebrew](https://brew.sh/) package manager:
      `$ brew install --cask github`

Installers for various Linux distributions can be found on the
[`shiftkey/desktop`](https://github.com/shiftkey/desktop) fork.

## Is GitHub Desktop right for me? What are the primary areas of focus?

[This document](https://github.com/desktop/desktop/blob/development/docs/process/what-is-desktop.md) describes the focus of GitHub Desktop and who the product is most useful for.

## I have a problem with GitHub Desktop

Note: The [GitHub Desktop Code of Conduct](https://github.com/desktop/desktop/blob/development/CODE_OF_CONDUCT.md) applies in all interactions relating to the GitHub Desktop project.

First, please search the [open issues](https://github.com/desktop/desktop/issues?q=is%3Aopen)
and [closed issues](https://github.com/desktop/desktop/issues?q=is%3Aclosed)
to see if your issue hasn't already been reported (it may also be fixed).

There is also a list of [known issues](https://github.com/desktop/desktop/blob/development/docs/known-issues.md)
that are being tracked against Desktop, and some of these issues have workarounds.

If you can't find an issue that matches what you're seeing, open a [new issue](https://github.com/desktop/desktop/issues/new/choose),
choose the right template and provide us with enough information to investigate
further.

## The issue I reported isn't fixed yet. What can I do?

If nobody has responded to your issue in a few days, you're welcome to respond to it with a friendly ping in the issue. Please do not respond more than a second time if nobody has responded. The GitHub Desktop maintainers are constrained in time and resources, and diagnosing individual configurations can be difficult and time consuming. While we'll try to at least get you pointed in the right direction, we can't guarantee we'll be able to dig too deeply into any one person's issue.

## How can I contribute to GitHub Desktop?

The [CONTRIBUTING.md](./.github/CONTRIBUTING.md) document will help you get setup and
familiar with the source. The [documentation](docs/) folder also contains more
resources relevant to the project.

If you're looking for something to work on, check out the [help wanted](https://github.com/desktop/desktop/issues?q=is%3Aissue+is%3Aopen+label%3A%22help%20wanted%22) label.

## Building Desktop

To setup your development environment for building Desktop, check out: [`setup.md`](./docs/contributing/setup.md).

## More Resources

See [desktop.github.com](https://desktop.github.com) for more product-oriented
information about GitHub Desktop.

See our [getting started documentation](https://docs.github.com/en/desktop/overview/getting-started-with-github-desktop) for more information on how to set up, authenticate, and configure GitHub Desktop.

## License

**[MIT](LICENSE)**

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all
GitHub trademarks. GitHub's logos include, for instance, the stylized
Invertocat designs that include "logo" in the file title in the following
folder: [logos](app/static/logos).

GitHub® and its stylized versions and the Invertocat mark are GitHub's
Trademarks or registered Trademarks. When using GitHub's logos, be sure to
follow the GitHub [logo guidelines](https://github.com/logos).
