# DSH Context Bridge

[English](README.en.md) · [日本語](README.ja.md)

DSH Context Bridge 把 ChatGPT 和 Claude Code 的历史会话导入 DeepSeek Harness（DSH）。选好本地项目和相关会话后，插件会生成一份带出处的交接摘要，并把所选会话归入 DSH 工作区。打开项目交接会话后，可以从已填好的草稿接着做。

[安装](#安装) · [准备会话与文件](#准备会话与文件) · [迁移项目](#迁移项目) · [排查问题](#排查问题) · [更新与卸载](#更新与卸载)

## 安装

### Windows 自动安装

从仓库下载 [install.ps1](install.ps1)，然后在 PowerShell 中进入脚本所在目录。首次使用桌面端时，先启动一次 DeepSeek Harness，再从应用菜单或系统托盘完全退出。

```powershell
Unblock-File -LiteralPath .\install.ps1
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\install.ps1
```

脚本会查找 `dsh.cmd`，下载并校验 v0.1.1 的安装包，然后将插件和 `dsh-chat-import@0.26.6` 装入 `desktop` profile。安装完成后重新打开应用。请先检查脚本内容，再解除该文件的下载标记。`RemoteSigned` 仅用于本次 PowerShell 进程。

- **Web 版** 在安装命令末尾加 `-Profile web`，完成后重启 Web 服务。
- **自定义安装位置** 使用 `-DshCliPath` 指定 `dsh.cmd` 的完整路径。
- **已有安装包** 把官方 `.tgz` 放在脚本旁，或通过 `-PackagePath` 指定文件。依赖仍由 DSH 安装。

### 兼容性与安装包

| 运行方式 | 本版验证环境 | 安装目标 |
| --- | --- | --- |
| DeepSeek Harness 桌面端 | Windows，DSH `0.2.2-rc.3`，已验证安装、扫描和预览 | `desktop` |
| DeepSeek Harness Web | Windows，npm CLI `0.2.2-rc.1` 和桌面内置 CLI `0.2.2-rc.3`，已验证导入、工作区归组和续接草稿 | `web` |

以下命令以 Context Bridge `0.1.1` 和依赖 `dsh-chat-import@0.26.6` 为准。每个 profile 独立安装和启用插件。macOS、Linux 和其他 DSH 版本尚未完成兼容性验证。

如果本仓库的 **Releases** 提供 `dsh-context-bridge-0.1.1.tgz`，下载后直接用该文件安装。手头只有仓库源码时，可以按[从源码打包](#从源码打包)生成同名文件。

### Windows 桌面端

1. 启动一次 DeepSeek Harness 桌面应用，让它初始化 `desktop` profile。
2. 从标题栏选择 **应用 → 退出**，或从系统托盘选择 **退出 DeepSeek Harness**。标题栏的 **×** 可能只是隐藏窗口。 [DeepSeek Harness 桌面端文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md)
3. 打开 PowerShell，进入存放 `.tgz` 的目录。下面的命令以下载目录为例，使用桌面端自带的 `dsh.cmd` 和内置 pnpm。

```powershell
Set-Location "$env:USERPROFILE\Downloads"
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

& $dshCli --version
& $dshCli plugin --profile desktop add 'dsh-chat-import@0.26.6' "file:$packagePath"
```

看到安装结果列出 `dsh-chat-import` 和 `dsh-context-bridge` 后，从开始菜单重新打开 **DeepSeek Harness**。左下角应出现 **项目迁移**，也可以在 **插件** 页面检查两项是否启用。

如果更改过安装位置，把 `$dshCli` 指向实际安装目录中的 `resources\runtime\cli\bin\dsh.cmd`。也可以从桌面应用的 **应用 → 管理 dsh 命令…** 注册命令后打开新终端。确认 `Get-Command dsh` 指向桌面端自带的启动器，再用 `dsh` 代替 `& $dshCli`。桌面端的 profile 由该启动器管理。 [DeepSeek Harness 桌面端命令说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md#终端命令)

### Web 版

已有 Windows 桌面端时，可以复用内置 CLI。从 PowerShell 进入 `.tgz` 所在目录，再执行以下命令。

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

& $dshCli plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
& $dshCli web
```

使用 npm CLI 时，DSH `0.2.2-rc.1` 要求 Node.js `24.9.0` 或更新版本，安装插件前还要确认 `pnpm --version` 能运行。Windows PowerShell 可调用 `npx.cmd`。若已有对应版本的 `dsh`，也可用它执行相同命令。以下命令同样在 `.tgz` 所在目录运行。 [DeepSeek Harness Web 启动说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.zh.md#通过-npm-运行)

```powershell
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' web
```

如果 Web 服务已在运行，先停止旧进程，再重新启动。用启动时打开的浏览器页面或终端打印的地址进入 DSH。多个实例并存时，确认浏览器打开的是刚安装插件的实例。

### 从源码打包

在包含 `package.json` 和 `cordis.patch.yml` 的仓库根目录执行：

```powershell
npm.cmd pack
```

npm 会按 `package.json` 的版本生成 `dsh-context-bridge-0.1.1.tgz`。macOS 和 Linux 使用 `npm pack` 即可生成安装包。

## 准备会话与文件

### ChatGPT

1. 在 ChatGPT 网页版进入 **设置 → 数据控制 → 导出数据**，按提示确认。能否自行导出取决于账户和工作区设置。 [OpenAI 数据导出说明](https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data)
2. 下载并解压 ChatGPT 发来的 ZIP。在解压目录中找到 `conversations.json` 或实际包含对话数据的 JSON 文件。可以通过文件名和内容结构识别它，顶层是包含会话条目的 JSON 数组。
3. 把单个会话 JSON 文件的绝对路径填进插件的 **ChatGPT 导出文件**。例如 `C:\Exports\chatgpt\conversations.json`。当前版本每次接收一个 JSON 文件。若导出有多份会话 JSON，按文件分批迁移。

插件从 ChatGPT 导出中处理会话主分支。附件能否还原取决于导出文件实际包含的数据和上游导入器。项目文件若需补充，可以先放进目标项目目录，再填写相对路径。

### Claude Code

勾选 **扫描 Claude Code**。来源留空时，导入器会查找 DSH 主机当前账户的默认会话目录，Windows 通常是 `%USERPROFILE%\.claude\projects`，macOS 和 Linux 通常是 `~/.claude/projects`。 [dsh-chat-import 用法](https://github.com/Nwflower/dsh-chat-import/blob/main/docs/USAGE.md)

如果只迁移某个项目，填入该项目的会话日志目录。也可以指定单个主会话 `.jsonl` 文件。手动填写时使用展开后的绝对路径，例如 `C:\Users\alex\.claude\projects\demo-project`。正在继续写入的会话可能在预览后发生变化，等源会话写入结束后再生成预览。

### 本地项目目录

选择你希望在 DSH 中继续工作的现有目录，例如 `D:\Projects\TaskBoardDemo`。插件将该目录注册或复用为工作区，会话中的文件访问以该目录为起点。项目文件留在原路径。

使用远程 Web 实例时，先把要导入的文件放到 **运行 DSH 的主机** 上，再填写该主机上的项目和文件路径。运行 DSH 的账户需要有读取权限。

## 迁移项目

### 1. 扫描并选择会话

打开左下角的 **项目迁移**，填写 **本地项目目录** 和至少一个会话来源。ChatGPT 和 Claude Code 可以在同一批次使用。

按需填写以下两项：

- **项目关键词**帮助匹配标题和项目名。可输入旧项目名、模块名或其他曾出现在聊天标题里的词，用逗号分隔。例如 `任务列表, 搜索功能`。
- **补充项目文件**每行填写一个已存在的项目内文件，例如 `Docs/开发笔记.md`。这些路径会进入关联文件清单，供续接时查阅。预览只读取这些补充文件的路径信息。

点击 **扫描会话**。插件根据工作目录、项目名、标题和关键词给出匹配建议，默认勾选最多 12 条。逐条检查并调整选择。想找未自动匹配的会话，可以搜索标题、来源或匹配理由。每次可选择 1 至 12 条。

### 2. 核对预览并导入

点击 **预览迁移**，核对目标目录，并展开 **待导入会话** 和 **关联项目文件**。如果项目包含已识别的配置，还可以展开 **Skills、MCP 与 Hooks（仅预览）**，查看配置的位置。

**交接摘要**按目标、决定、进度、待办和最近请求摘录历史记录，并标出对应会话。它使用本地规则提取，长会话会抽样。历史中写过的“已实现”以原消息为依据，实际完成情况仍要结合当前项目文件核实。

点击 **导入 N 个会话** 后，插件创建或复用原生 DSH 工作区，并写入所选会话。结果会逐条显示 **已导入**、**此前已导入**、**已更新** 或 **导入失败**。若某条附有 **归组提示**，可先用该条的打开按钮定位会话，再核对侧栏工作区。部分失败时可以查看错误，处理后重新预览并重试；已成功的会话通常会由上游识别为已导入。

### 3. 继续工作

- 点 **打开项目并续接**，进入该工作区的项目交接会话，交接摘要会填入草稿。
- 点某条结果旁的 **打开并填入续接草稿**，可以回到该会话的原有历史，再用同一份交接摘要继续。
- 如果输入框已有草稿或正在发送，插件会保留当前内容。用 **复制摘要** 手动合并即可。

扫描、预览、导入和填入草稿都在 DSH 主机上进行，无需模型 API Key。检查草稿后，在 DSH 选择可用模型再发送。 [DSH 模型配置说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.zh.md#配置模型)

### 一个迁移示例

假设本地项目在 `D:\Projects\TaskBoardDemo`，ChatGPT 里讨论过任务列表的需求，Claude Code 里记录了搜索功能的实现。

1. 选择 `D:\Projects\TaskBoardDemo`，填入 ChatGPT 导出路径，并指定该项目的 Claude Code 日志目录。
2. 填入关键词 `任务列表, 搜索功能`。如果目录里有 `Docs/开发笔记.md`，把它填入补充文件。
3. 选中两边与项目相关的会话，检查摘要中的决定和待办，再导入。
4. 点 **打开项目并续接**，在草稿末尾加上当前任务，例如“先检查搜索结果为空时的界面”，确认后发送。

## 数据与当前限制

- 迁移按用户确认的批次执行。当前版本支持从本地会话文件单向导入，后续源变化需要重新扫描和预览。
- 补充文件必须在目标项目目录内。自动清单包括常见项目标记文件和部分一级目录，摘要只列出部分关联路径。
- Skills、MCP 和 Hooks 仅列出项目内识别到的配置位置。配置预览不迁移凭据、启用集成或执行 Hook。
- 导入会话保存在 DSH 原生会话存储。为识别重复导入，选中的 ChatGPT 会话还会在 `$DSH_HOME/dsh-context-bridge/chatgpt` 保存独立的本地快照。未设置 `DSH_HOME` 时使用用户目录下的 `.dsh`。快照含会话内容，提交 Issue 或共享日志之前请去掉相关路径、会话内容和密钥。
- 单个会话源文件的读取上限为 256 MiB。扫描结果和迁移预览通常可用约 20 分钟。重启 DSH 后需要重新扫描。

## 排查问题

| 现象 | 处理方法 |
| --- | --- |
| PowerShell 提示无法识别 `dsh` | 使用[桌面端内置启动器的完整路径](#windows-桌面端)。若通过应用菜单注册了命令，要打开新的 PowerShell 窗口。 |
| 找不到安装包或 `file:` 解析失败 | 进入实际保存 `.tgz` 的目录，先确认 `Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz'` 能返回路径，再按安装命令传入绝对路径。 |
| Desktop profile 未初始化或仍在运行 | 首次安装先打开桌面端一次，再用 **应用 → 退出** 彻底退出。若启用了托盘后台运行，从托盘退出。 |
| 安装完成后没有 **项目迁移** | 确认当前运行的是目标 profile，检查 **插件** 页的两项启用状态，然后重启应用或 Web 服务。 |
| pnpm 提示 `peer dependencies` | 以安装退出状态和 DSH 中的启用结果为准。已验证的组合在安装时也可能出现这类提示。若插件未能启用，记录启动错误和两个插件的版本。 |
| 提示安装或启用 `dsh-chat-import` | 在相同 profile 安装并启用 `dsh-chat-import@0.26.6`。同时安装两个包时，把它们写在同一条 `plugin ... add` 命令里即可。 |
| 路径不存在或没有权限 | 检查 DSH 主机上的绝对路径，以及运行 DSH 的账户是否有读取权限。补充文件路径从项目根目录算起。 |
| ChatGPT 文件无法读取或扫描结果为空 | 检查是否选中了会话 JSON，文件顶层是否是对话数组，以及文件大小。若账户拿不到导出，查看 OpenAI 的导出说明。 |
| Claude Code 找不到会话 | 用明确的日志目录或主会话 `.jsonl` 文件重新扫描。Claude Code 若运行在 WSL、容器或另一台电脑上，把日志放到 DSH 主机可读的位置。 |
| 提示源文件变更、扫描结果或预览已过期 | 重新扫描或重新生成预览。源仍在写入时，等写入结束后再试。 |
| 会话打开了，但摘要没填进输入框 | 检查输入框是否已有草稿或正在发送。也可以在导入结果中点 **复制摘要** 后手动粘贴。 |

若要报错，请附上操作系统、DSH 版本、插件版本、使用的 profile、脱敏的错误文本和复现步骤。有模拟会话能重现时，优先附模拟文件。

## 更新与卸载

更新时，下载对应版本的 `.tgz`，用新文件的绝对路径执行同一个 `plugin --profile … add` 命令。桌面端更新前需完全退出应用，Web 版更新后需重启服务。依赖版本以新版本的安装说明为准。

仅移除 Context Bridge 时，Windows 桌面端在完全退出后运行：

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $dshCli plugin --profile desktop remove dsh-context-bridge
```

Web 版将命令中的 profile 改为 `web`，并使用启动 Web 的同一个 CLI。已导入的会话和快照由 DSH 会话存储和本地快照目录分别管理。若还在使用上游 **导入会话** 功能，可继续保留 `dsh-chat-import`。

Context Bridge 复用上游的会话发现和导入服务，在其基础上处理项目匹配、迁移预览与续接。 [dsh-chat-import 第三方插件接口](https://github.com/Nwflower/dsh-chat-import/blob/main/docs/USAGE.md#for-third-party-plugins)
