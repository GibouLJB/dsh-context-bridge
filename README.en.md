# DSH Context Bridge

[简体中文](README.md) · [日本語](README.ja.md)

DSH Context Bridge imports selected ChatGPT and Claude Code conversations into a DeepSeek Harness (DSH) workspace. Choose an existing project directory, review the matching conversations and a handoff summary, then open the imported conversations or continue from a draft in the project workspace.

[Installation](#installation) · [Prepare your files](#prepare-your-files) · [Import and resume](#import-and-resume) · [Troubleshooting](#troubleshooting) · [Update or uninstall](#update-or-uninstall)

## Installation

### Automated installation on Windows

Download [install.ps1](install.ps1) and open PowerShell in the folder where you saved it. If this is your first time using DeepSeek Harness Desktop, open it once to initialize its profile, then quit it from the app menu or system tray.

```powershell
Unblock-File -LiteralPath .\install.ps1
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\install.ps1
```

The script locates `dsh.cmd`, downloads the v0.1.1 package from GitHub Releases, verifies its SHA-256 hash, and installs Context Bridge with `dsh-chat-import@0.26.6` in the `desktop` profile. Reopen DeepSeek Harness when it finishes. Review the script before unblocking the downloaded file. The `RemoteSigned` option applies to this PowerShell process.

- **Web.** Add `-Profile web` to the installation command, then restart DSH Web.
- **Custom DSH location.** Pass the full path to `dsh.cmd` with `-DshCliPath`.
- **Already downloaded the package.** Put the official `.tgz` next to the script or pass its path with `-PackagePath`. DSH still installs the dependency.

These instructions are for Context Bridge `0.1.1` and its dependency `dsh-chat-import@0.26.6`. Install both in the same DSH profile. The `desktop` and `web` profiles manage their plugins separately.

| Environment | DeepSeek Harness versions tested end to end | Profile |
| --- | --- | --- |
| Windows Desktop | `0.2.2-rc.1`, `0.2.2-rc.2`, `0.2.2-rc.3` | `desktop` |
| Windows Web | `0.2.1-rc.5`, `0.2.2-rc.1`, `0.2.2-rc.2`, `0.2.2-rc.3` | `web` |

Each combination passed import, workspace grouping, and resume draft tests with synthetic ChatGPT and Claude Code sessions, using Context Bridge `0.1.1` and `dsh-chat-import@0.26.6`. Other Harness versions, macOS, and Linux are still untested.

Get `dsh-context-bridge-0.1.1.tgz` from [GitHub Releases](https://github.com/GibouLJB/dsh-context-bridge/releases), or [build it from source](#build-the-package-from-source). The following PowerShell commands assume your current directory contains the package.

### Windows Desktop

1. Launch DeepSeek Harness Desktop once to initialize the `desktop` profile.
2. Quit it using **App → Quit** or the system tray. Closing the window with **×** can leave DSH running. [DeepSeek Harness Desktop documentation](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md)
3. Run the following in PowerShell. If DSH is installed in another directory, adjust `$dshCli` to point to its bundled `dsh.cmd`.

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

& $dshCli --version
& $dshCli plugin --profile desktop add 'dsh-chat-import@0.26.6' "file:$packagePath"
```

Reopen DeepSeek Harness. Look for **项目迁移** (Project Migration) at the bottom of the left sidebar. If you registered the bundled CLI from the app menu, open a fresh PowerShell window and check `Get-Command dsh` before using `dsh` directly.

### DSH Web

On Windows, you can also use the CLI bundled with Desktop to install and start the Web profile.

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

& $dshCli plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
& $dshCli web
```

For the npm CLI, DSH `0.2.2-rc.1` requires Node.js `24.9.0` or later. Check that `pnpm --version` works before installing the plugins. [DeepSeek Harness Web setup](https://github.com/deepseek-ai/deepseek-harness#run-from-npm)

```powershell
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' web
```

If DSH Web is already running, stop it before restarting. Open the address printed by the newly started instance.

### Build the package from source

Run `npm.cmd pack` in the repository root on Windows, or `npm pack` on macOS or Linux. For the `v0.1.1` source, this produces `dsh-context-bridge-0.1.1.tgz`. The compatibility checks above cover Windows.

## Prepare your files

- **ChatGPT.** Request an export under **Settings → Data Controls → Export Data** if you need a copy of your history. Unzip the download and locate `conversations.json` or a numbered conversation JSON file. The plugin accepts one JSON file per scan. Use separate batches for a split export. [OpenAI data export guide](https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data)
- **Claude Code.** Enable **扫描 Claude Code** (Scan Claude Code). Leave the source field blank to scan the default session directory, usually `%USERPROFILE%\.claude\projects` on Windows or `~/.claude/projects` on macOS and Linux. To narrow the scan, supply the absolute path to a project log directory or a main session `.jsonl` file. [dsh-chat-import usage](https://github.com/Nwflower/dsh-chat-import/blob/main/docs/USAGE.md)
- **Project directory.** Choose the existing directory where you want to resume work. DSH uses it as the workspace root, so files stay in place. For a remote Web instance, provide paths on the DSH host and make sure its account can read them.

## Import and resume

The plugin interface in v0.1.1 uses Chinese labels. The English translations below show which controls to use.

1. Open **项目迁移** (Project Migration) and fill in **本地项目目录** (Local Project Directory). Add one or both conversation sources. You can enter comma-separated **项目关键词** (Project Keywords), such as `task list, search`, and add project files under **补充项目文件** (Additional Project Files), one project-relative path per line.
2. Click **扫描会话** (Scan Conversations). The plugin suggests matches using working directories, project names, titles, and keywords. Review the suggestions and select 1–12 conversations. You can also search for conversations that were not selected automatically.
3. Click **预览迁移** (Preview Migration). Check the destination, selected conversations, related files, and handoff summary. The summary cites the source conversations and extracts goals, decisions, progress claims, and next steps. Long conversations are sampled, and progress claims still need to be checked against the project.
4. Click **导入 N 个会话** (Import N Conversations). The plugin creates or reuses a DSH workspace for the selected directory and reports the result for each conversation. Review any workspace grouping warnings or import failures before retrying.
5. Click **打开项目并续接** (Open Project and Resume) to fill a draft in the project handoff conversation. To resume inside an imported conversation, use **打开并填入续接草稿** (Open and Fill Resume Draft). If the composer already contains a draft or is sending, use **复制摘要** (Copy Summary) to merge the text yourself.

Scanning, previewing, importing, and filling the draft run on the DSH host without a model API key. Review the draft and select a configured model when you are ready to send it. [DSH model configuration](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md)

## Data and limits

- Imports are one-way and run in confirmed batches. After a source changes, scan again and generate a fresh preview. Scan results and previews are usually valid for about 20 minutes. The size limit is 256 MiB per source file.
- ChatGPT imports use the main conversation branch. Attachment recovery depends on the export and the upstream importer.
- Additional project files must be inside the workspace directory. The plugin lists recognized locations for Skills, MCP, and Hooks as a preview.
- Imported conversations use DSH's native session storage. To recognize repeat imports, the plugin saves a local snapshot of each selected ChatGPT conversation under `$DSH_HOME/dsh-context-bridge/chatgpt`. If `DSH_HOME` is unset, DSH uses `.dsh` under your home directory. Snapshots contain conversation text. Remove private paths, content, and secrets before sharing logs or opening an issue.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| PowerShell cannot find `dsh` | Use the [full path to the bundled CLI](#windows-desktop). If you just registered it, open a new terminal. |
| Package path cannot be resolved | Switch to the directory containing the `.tgz`, or resolve its absolute path before passing it to `file:`. |
| Desktop profile is missing or busy | Launch Desktop once and quit it explicitly before installing. |
| The migration button is missing | Check that both plugins are enabled in the running profile, then restart Desktop or Web. |
| pnpm reports peer dependency warnings | Check the install exit status and whether both plugins load in DSH. Include the exact versions and startup error if reporting a failure. |
| ChatGPT JSON is rejected or returns no conversations | Use an extracted conversation JSON file with a top-level array. Check the per-file size limit and whether the file is readable from the DSH host. |
| Claude Code scan finds no sessions | Enter a specific session directory or main `.jsonl` path. For WSL, containers, or another machine, make the logs readable from the DSH host. |
| The source changed or the preview expired | Let the source finish writing, then scan or preview again as prompted. |
| The conversation opens without a summary draft | Check for an existing draft or an active send. Use **复制摘要** (Copy Summary) to paste it manually. |

When reporting an issue, include the OS, DSH and plugin versions, active profile, sanitized error text, and steps to reproduce it.

## Update or uninstall

To update, use the matching installation command with the absolute path to the new `.tgz`. Quit Desktop before updating it and restart Web after updating that profile.

To remove Context Bridge from Desktop, quit the app and run the following with the bundled CLI.

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $dshCli plugin --profile desktop remove dsh-context-bridge
```

For Web, use the same CLI you use to start Web and pass `--profile web`. Imported conversations and local snapshots are managed separately. You can keep `dsh-chat-import` for its own import tools.
