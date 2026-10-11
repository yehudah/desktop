# Linux port QA test plan and results

Manual, black-box QA of the Linux build of GitHub Desktop 3.6.6 (x64). Run on 2026-10-11 by Claude for Yehuda against a private throwaway repository. Result: **49 of 52 cases passed**; the 3 failures are tracked as issues (see [Bugs](#bugs)).

## Environment

| Item | Value |
| --- | --- |
| OS | Kali Linux 2026.2, Xfce on X11, in VMware Fusion (macOS host) |
| App | `/usr/lib/github-desktop` (`.deb` install), version 3.6.6 (x64) |
| git / Python | 2.53.0 / 3.13.12 |
| Editor / file manager / browser / terminal | VS Code / Thunar / Firefox / QTerminal (no gnome-terminal) |
| Account | GitHub.com, already signed in before the run |
| Test repo | private `gd-qa-sample` (a small Python CLI with a unit test, README, `.gitignore`, PNG) |
| Second collaborator | a second CLI clone pushing to the same remote |

## How to re-run

1. Create a throwaway folder outside any real project (for example `~/qa-sandbox/gd-qa-sample`) with a few source files and a PNG, without running `git init`.
2. Launch the app from a terminal and keep its output: `nohup github-desktop > ~/qa-sandbox/gd.log 2>&1 &`.
3. Work through the tables below in order; each case lists what to do and what to check. Check git state from the CLI (`git log --oneline --graph --all`, `git status -sb`, `git ls-remote origin`) after every remote-changing step.
4. For pull/conflict cases, simulate a collaborator with a second clone that commits and pushes from the CLI.
5. For the offline case, disconnect the machine's (or VM's) network adapter, then reconnect.

## Results

### Setup and publish

| ID | Case | Result | Notes |
| --- | --- | --- | --- |
| S1 | Launch from terminal | Pass | Reopens last repository |
| S2 | File > Add local repository on a non-git folder | Pass | "Not a Git repository … create a repository" shown on submit |
| S3 | Create repository dialog | Pass | Prefills name and path; auto "Initial commit"; adds `.gitattributes` |
| S4 | History: file list, text diff, PNG image diff | Pass | |
| S5 | Publish repository with "Keep this code private" | Pass | Anonymous GET of the repo URL returns 404 |

### Core git flows

| ID | Case | Result | Notes |
| --- | --- | --- | --- |
| T1 | Multi-file commit, summary + multi-line unicode description, Ctrl+Enter | Pass | |
| T2 | History context menu enabled/disabled states | Pass | View on GitHub disabled while unpushed |
| T3 | Amend an unpushed commit | Pass | Hash changes, still 1 ahead |
| T4 | Push (Ctrl+P) | Pass | |
| T5a | Amend a pushed commit | Pass | "Amend will require force push" warning |
| T5b | Force push | Pass | Confirmation dialog, Cancel is the default; remote verified |
| T6 | Partial commit (deselect single lines) | Pass | Word-level diff highlight |
| T7 | Undo last commit | Pass | Warns when changes are in progress; restores message |
| T8 | Discard changes | Pass | Discarded copy lands in `~/.local/share/Trash` with `.trashinfo` |
| T9 | Branch create (Ctrl+Shift+N), publish, rename, delete local + remote | Pass | Name with a space sanitised to `-`; rename warns the remote name is kept; remote delete removes the tracked name |
| T10 | Merge into current branch (Ctrl+Shift+M) | Pass | |
| T11 | Merge conflict, resolve with "use the modified file from …", continue | Pass | Conflict count predicted before merging |
| T12 | Switch branch with changes → leave on branch (stash), restore | Pass | |
| T13 | Revert a commit | Pass | Reset disabled for pushed commits |
| T14 | Cherry-pick via menu (conflict → abort; clean) and by drag onto branch list | Pass | While dragging, the branch list opens only when hovering the right part of the Current branch button |
| T15 | Squash and reorder by drag in History | Pass | Both show an Undo banner |
| T16 | Fetch, then pull a collaborator's commit | Pass | |
| T17 | Pull with diverged history | Pass | Rejected push → "Newer commits on remote" dialog with Fetch; pull makes a merge commit |
| T18 | Co-author | Pass | `Co-Authored-By` trailer written; co-authors carry over to the next commit (upstream behaviour) |
| T19 | Create tag and push | Pass | Annotated tag pushed with the branch |
| T20 | Ignore file from the Changes context menu | Pass | |
| T21 | File > Clone repository (private, custom path), then Remove + "move to Trash" | Pass | Duplicate names told apart by the path tooltip |
| T22 | Compare branches | Pass | Ahead/behind counts correct |
| T23 | Create pull request (Ctrl+R) | Pass | Opens default browser at the compare page |
| X1 | Worktrees: New worktree (Ctrl+Shift+W), switcher, delete current worktree | Pass | Extra case |

### Linux integration

| ID | Case | Result | Notes |
| --- | --- | --- | --- |
| L1 | Open in external editor (Ctrl+Shift+A) | Pass | VS Code auto-detected |
| L2 | Show in file manager (Ctrl+Shift+F) | Pass | Thunar |
| L3 | Open in terminal (Ctrl+`) | **Fail** | BUG-1 |
| L4 | Links open the default browser | Pass | `xdg-open` → Firefox |
| L5 | File watcher picks up external edits and CLI commits | Pass | |
| L6 | Sign-in persists across quit and relaunch | Pass | |
| L7 | `x-github-client://openRepo/<url>` deep link | Pass | Focuses the existing clone and fetches |
| L8 | Second launch focuses the running instance | Pass | |
| L9 | Window state and last repository persist | Pass | |
| L10 | Options > Integrations lists editors and shells | **Partial** | Editor found; no shell detected (BUG-1) |
| L11 | Help > About > Check for Updates | **Fail** | BUG-2 |
| L12 | `.desktop` entry (`Exec %U`, icon, `MimeType` handlers) | Pass | |

### Diff and history edge cases

| ID | Case | Result | Notes |
| --- | --- | --- | --- |
| E1 | Unicode/emoji and spaces in file names | Pass | |
| E2 | 40,000-line text file diff | Pass | Renders quickly |
| E3 | Binary file | Pass | "This binary file has changed" |
| E4 | CRLF file | Pass | Line-ending warning banner |
| E5 | Rename | Pass | "The file was renamed but not changed" |
| E6 | Deleted image | Pass | Deleted image preview |
| E7 | Summary longer than 72 characters | Pass | Length hint; overflow moved into the description |

### UI and robustness

| ID | Case | Result | Notes |
| --- | --- | --- | --- |
| U1 | Theme: System / Light / Dark | Pass | System follows the Xfce dark theme |
| U2 | Keyboard shortcuts (18 checked) | Pass | Help > Keyboard shortcuts opens docs with Mac/Windows tabs only |
| U3 | Offline fetch, then reconnect | Pass | Recovers without restart; error wording is BUG-3 |
| U4 | App output and log review | Pass | Only VM GPU (VAAPI) and X11 atom-cache noise, plus Node `DEP0169` `url.parse()` deprecation |

## Bugs

| ID | Severity | Summary |
| --- | --- | --- |
| [BUG-1](https://github.com/yehudah/desktop/issues/2) | Medium | Open in Terminal crashes with `Cannot read properties of undefined (reading 'path')` when no supported terminal is installed (Kali/Xfce, QTerminal only). The menu still says "Open in GNOME Terminal". Workaround: custom shell `/usr/bin/qterminal` with arguments `-w %TARGET_PATH%`. |
| [BUG-2](https://github.com/yehudah/desktop/issues/3) | Low | Help > About > Check for Updates does nothing on Linux (no feedback, no log line). |
| [BUG-3](https://github.com/yehudah/desktop/issues/4) | Low | Offline fetch shows the raw git `Could not resolve host` text in an oversized error box. Compare with upstream before fixing. |

## Not covered yet

- [ ] Fresh sign-in through the browser and device code (the run started signed in)
- [ ] Ubuntu 24.04 GNOME and a KDE distro (konsole)
- [ ] Wayland session: window, drag and drop, clipboard, HiDPI
- [ ] Install and upgrade of every shipped format (`.deb`, AppImage)
- [ ] Credential storage without a Secret Service provider
- [ ] SSH remotes and commit signing (GPG/SSH)
- [ ] Git LFS and submodules
- [ ] GitHub Enterprise sign-in
- [ ] Notifications and tray
- [ ] Performance on a large real repository
- [ ] Accessibility: keyboard-only use, Orca screen reader

## TODO

- [ ] Release builds should be built with OAuth secrets. Builds without them (like the one tested) set `__DEV_SECRETS__`, so the app and `.desktop` file register the `x-github-desktop-dev-auth` sign-in callback instead of `x-github-desktop-auth`. That works, but a co-installed upstream dev build would claim the same callback. See the TODO in `app/src/main-process/main.ts`.
