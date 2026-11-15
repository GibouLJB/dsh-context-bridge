# DSH Context Bridge

[简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

DSH Context Bridge 可將 ChatGPT 和 Claude Code 的歷史對話匯入 DeepSeek Harness（DSH）。選取本機專案和相關對話後，外掛會產生一份標註來源的交接摘要，並將選取的對話歸入 DSH 工作區。開啟專案交接對話後，即可從預先填入的草稿接續工作。

[安裝](#安裝) · [準備對話與檔案](#準備對話與檔案) · [遷移專案](#遷移專案) · [疑難排解](#疑難排解) · [更新與解除安裝](#更新與解除安裝)

## 安裝

### Windows 自動安裝

從儲存庫下載 [install.ps1](install.ps1)，再用 PowerShell 開啟指令碼所在的資料夾。如果是第一次使用 DeepSeek Harness 桌面版，請先啟動一次，然後從應用程式選單或系統匣完全結束程式。

請先檢查指令碼內容，再解除下載檔案的封鎖。`RemoteSigned` 僅套用至這次啟動的 PowerShell 程序。

```powershell
Unblock-File -LiteralPath .\install.ps1
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\install.ps1
```

指令碼會尋找 `dsh.cmd`、下載並驗證 v0.1.3 安裝套件的 SHA-256，接著將 Context Bridge 和 `dsh-chat-import@0.26.6` 安裝到 `desktop` 設定檔（profile）。完成後請重新開啟應用程式。

- **Web 版** 在安裝指令末尾加上 `-Profile web`，完成後重新啟動 Web 服務。
- **自訂安裝位置** 使用 `-DshCliPath` 指定 `dsh.cmd` 的完整路徑。
- **已有安裝套件** 將官方 `.tgz` 放在指令碼所在的資料夾，或用 `-PackagePath` 指定檔案。相依套件仍由 DSH 安裝。

### 相容性與安裝套件

v0.1.3 已在 Windows 原生桌面版 Harness 0.2.2-rc.3 驗證完整遷移，並確認同版本 Web 設定檔可安裝。下表記錄 v0.1.2 的完整遷移測試。

| 執行環境 | 已通過完整遷移測試的 DeepSeek Harness 版本 | 設定檔 |
| --- | --- | --- |
| Windows 桌面版 | `0.2.2-rc.1`、`0.2.2-rc.2`、`0.2.2-rc.3` | `desktop` |
| Windows Web 版 | `0.2.1-rc.5`、`0.2.2-rc.1`、`0.2.2-rc.2`、`0.2.2-rc.3` | `web` |

上述組合皆使用 Context Bridge `0.1.2` 和 `dsh-chat-import@0.26.6`，以測試用的 ChatGPT 和 Claude Code 對話驗證匯入、工作區歸類和接續草稿。其他 Harness 版本、macOS 和 Linux 尚待驗證。

各設定檔分別安裝及啟用外掛。可從 [GitHub Releases](https://github.com/GibouLJB/dsh-context-bridge/releases/tag/v0.1.3) 下載 `dsh-context-bridge-0.1.3.tgz`，也可[從原始碼打包](#從原始碼打包)。

### Windows 桌面版

1. 啟動一次 DeepSeek Harness 桌面應用程式，以初始化 `desktop` 設定檔。
2. 從應用程式選單或系統匣結束 DeepSeek Harness。按視窗的 **×** 可能只會隱藏視窗。 [DeepSeek Harness 桌面版文件](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md)
3. 開啟 PowerShell，進入存放 `.tgz` 的資料夾。以下以「下載」資料夾為例，使用桌面版隨附的 `dsh.cmd` 和 pnpm。

```powershell
Set-Location "$env:USERPROFILE\Downloads"
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.3.tgz').Path.Replace('\', '/')

& $dshCli --version
& $dshCli plugin --profile desktop add 'dsh-chat-import@0.26.6' "file:$packagePath"
```

看到安裝結果列出 `dsh-chat-import` 和 `dsh-context-bridge` 後，從開始功能表重新開啟 **DeepSeek Harness**。左下角應出現 **项目迁移**（專案遷移），也可到 **插件** 頁面確認兩個外掛是否已啟用。

若使用自訂安裝位置，請將 `$dshCli` 指向實際安裝目錄中的 `resources\runtime\cli\bin\dsh.cmd`。也可從桌面應用程式選單註冊 `dsh` 指令，再開啟新的 PowerShell 視窗。確認 `Get-Command dsh` 指向桌面版隨附的啟動程式後，即可用 `dsh` 取代 `& $dshCli`。 [DeepSeek Harness 桌面版指令說明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md#终端命令)

### Web 版

如果已安裝 Windows 桌面版，可使用隨附的 CLI。請在 PowerShell 進入 `.tgz` 所在的資料夾，再執行以下指令。

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.3.tgz').Path.Replace('\', '/')

& $dshCli plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
& $dshCli web
```

如果使用 npm CLI，DSH `0.2.2-rc.1` 需要 Node.js `24.9.0` 或更新版本。安裝外掛前，請確認 `pnpm --version` 能正常執行。請在 `.tgz` 所在的資料夾執行下列指令。 [DeepSeek Harness Web 版啟動說明](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.zh.md#通过-npm-运行)

```powershell
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.3.tgz').Path.Replace('\', '/')

npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' web
```

若 Web 服務已在執行，請先停止，再重新啟動。使用啟動時開啟的瀏覽器頁面或終端機顯示的網址進入 DSH。若同時執行多個執行個體，請確認瀏覽器連到剛安裝外掛的那一個。

### 從原始碼打包

在包含 `package.json` 和 `cordis.patch.yml` 的儲存庫根目錄執行下列指令。

```powershell
npm.cmd pack
```

使用 `v0.1.3` 原始碼會產生 `dsh-context-bridge-0.1.3.tgz`。macOS 和 Linux 可用 `npm pack` 打包。

## 準備對話與檔案

以下以外掛介面上的原始按鈕和欄位名稱標示操作步驟，方便對照畫面。

### ChatGPT

1. 在 ChatGPT 網頁版開啟 **設定 → 資料控制 → 匯出資料**，再依提示確認。能否自行匯出取決於帳號和工作區設定。 [OpenAI 資料匯出說明](https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data)
2. 下載 ChatGPT 寄來的 ZIP，將它在 DSH 主機上的絕對路徑填入 **ChatGPT 导出文件**。也可直接指定對話 JSON。ZIP 內的 `conversations.json` 與帶編號的對話 JSON 會一併掃描，解壓縮後的對話資料合計上限為 256 MiB。

專案目錄、匯出檔案、Claude Code 來源或補充檔案的路徑有誤時，提示會顯示在對應欄位旁。

外掛會處理匯出對話的主要分支。附件能否還原，取決於匯出內容及相依匯入外掛。若需要補充專案檔案，可先放入目標專案資料夾，再填入相對路徑。

### Claude Code

勾選 **扫描 Claude Code**。若來源欄位留空，匯入外掛會搜尋 DSH 主機目前帳號的預設對話目錄。Windows 通常是 `%USERPROFILE%\.claude\projects`，macOS 和 Linux 通常是 `~/.claude/projects`。 [dsh-chat-import 使用說明](https://github.com/Nwflower/dsh-chat-import/blob/main/docs/USAGE.md)

若只想遷移特定專案，請指定該專案的對話記錄資料夾，或單一主要對話的 `.jsonl` 檔案。手動輸入時請用完整的絕對路徑，例如 `C:\Users\alex\.claude\projects\demo-project`。仍在寫入的對話可能在預覽後變更，建議等寫入完成再產生預覽。

### 本機專案資料夾

請選取你要在 DSH 繼續工作的既有資料夾，例如 `D:\Projects\TaskBoardDemo`。外掛會將該目錄註冊為工作區，或沿用既有工作區。對話會以該目錄作為存取檔案的起點，專案檔案會留在原路徑。

若使用遠端 Web 執行個體，請先將要匯入的檔案放在**執行 DSH 的主機**上，再填入該主機上的專案與檔案路徑。執行 DSH 的帳號需要有讀取權限。

## 遷移專案

在側欄的工作區按右鍵並選擇「项目迁移」，即可自動填入目錄。也可從全域遷移入口選擇既有工作區。Windows 桌面版可點選「瀏覽…」選取 ChatGPT ZIP 或 JSON。Web 版請填入 DSH 主機上的絕對路徑。

### 1. 掃描並選取對話

開啟左下角的 **项目迁移**，填入 **本地项目目录** 和至少一個對話來源。ChatGPT 和 Claude Code 可以一起遷移。

- **项目关键词** 用於比對標題與專案名稱。可輸入舊專案名稱、模組名稱或曾出現在對話標題中的詞，以逗號分隔，例如 `任務清單, 搜尋功能`。
- **补充项目文件** 每行填入一個已存在的專案檔案，例如 `Docs/開發筆記.md`。這些路徑會列入相關檔案清單。預覽只會讀取補充檔案的路徑資訊。

點選 **扫描会话**。外掛會依工作目錄、專案名稱、標題和關鍵字提供比對建議，預設最多勾選 12 條。請逐條確認並調整，也可依標題、來源或比對原因搜尋。每批可選 1 至 12 條。

### 2. 檢查預覽並匯入

點選 **预览迁移**，確認目標目錄，再展開 **待导入会话** 和 **关联项目文件**。若專案包含外掛能辨識的設定，也可展開 **Skills、MCP 与 Hooks（仅预览）** 查看位置。

**交接摘要**會依目標、決策、進度、待辦事項及近期請求擷取文字，並標註所對應的對話。摘要依本機規則產生，長對話會取樣。若摘要引用「已實作」等說法，請對照目前的專案檔案確認進度。

點選 **导入 N 个会话** 後，外掛會建立或沿用 DSH 工作區，並寫入選取的對話。每條結果會標示 **已导入**、**此前已导入**、**已更新** 或 **导入失败**。若有 **归组提示**，可用該項的開啟按鈕找到對話，再確認側欄中的工作區。部分匯入失敗時，可查看錯誤，處理後重新預覽並重試。成功匯入的對話通常會由相依匯入外掛辨識為已匯入。

### 3. 接續工作

- 點選 **打开项目并续接**，進入工作區的專案交接對話，交接摘要會自動填入草稿。
- 點選個別結果旁的 **打开并填入续接草稿**，可回到那條對話的歷史紀錄，再從同一份交接摘要接著工作。
- 如果輸入框已有草稿或正在傳送，外掛會保留原有內容。可點選 **复制摘要**，再手動合併。

掃描、預覽、匯入和填入草稿都在 DSH 主機上執行，不需要模型 API 金鑰。確認草稿後，可在 DSH 選取可用的模型再傳送。 [DSH 模型設定說明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.zh.md#配置模型)

### 遷移範例

假設本機專案位於 `D:\Projects\TaskBoardDemo`，ChatGPT 中有任務清單的需求討論，Claude Code 中記錄了搜尋功能的實作過程。

1. 選取 `D:\Projects\TaskBoardDemo`，填入 ChatGPT 匯出檔案的路徑，再指定該專案的 Claude Code 記錄資料夾。
2. 填入關鍵字 `任務清單, 搜尋功能`。若資料夾中有 `Docs/開發筆記.md`，可將它加入補充檔案。
3. 選取兩個來源中與專案相關的對話，核對摘要中的決策和待辦事項，再匯入。
4. 點選 **打开项目并续接**，在草稿末尾加上目前的任務，例如「先檢查沒有搜尋結果時的畫面」，確認後傳送。

## 資料與目前限制

- 遷移會依使用者確認的批次執行。目前可從本機對話檔案單向匯入。若來源有變更，須重新掃描和預覽。
- 補充檔案須在目標專案目錄內。自動清單包含常見的專案標記檔案和部分第一層資料夾，摘要只會列出部分相關路徑。
- Skills、MCP 和 Hooks 預覽只會列出專案內辨識到的設定位置，不會遷移憑證、啟用整合或執行 Hook。
- 匯入的對話會儲存在 DSH 的原生對話儲存空間。為辨識重複匯入，選取的 ChatGPT 對話也會在 `$DSH_HOME/dsh-context-bridge/chatgpt` 儲存個別的本機快照。若未設定 `DSH_HOME`，會使用使用者目錄下的 `.dsh`。快照包含對話內容，提交 Issue 或分享記錄前，請移除相關路徑、對話內容和金鑰。
- 單一來源檔案的讀取上限為 256 MiB。掃描結果和遷移預覽通常可使用約 20 分鐘。重新啟動 DSH 後須再次掃描。

## 疑難排解

| 狀況 | 處理方法 |
| --- | --- |
| PowerShell 無法辨識 `dsh` | 使用[桌面版隨附啟動程式的完整路徑](#windows-桌面版)。若已從應用程式選單註冊指令，請開啟新的 PowerShell 視窗。 |
| 找不到安裝套件，或無法解析 `file:` | 進入 `.tgz` 所在的資料夾，確認 `Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.3.tgz'` 能取得路徑，再將絕對路徑傳給安裝指令。 |
| `desktop` 設定檔尚未初始化，或桌面版仍在執行 | 首次安裝時，先啟動桌面版一次，再從應用程式選單或系統匣完全結束程式。 |
| 安裝完成後看不到 **项目迁移** | 確認目前使用的是目標設定檔，並在 **插件** 頁面確認兩個外掛都已啟用，再重新啟動應用程式或 Web 服務。 |
| pnpm 顯示 `peer dependencies` 提示 | 檢查安裝指令的結束狀態和 DSH 中的外掛啟用結果。已驗證的組合也可能出現此提示。若外掛無法啟用，請記錄啟動錯誤與兩個外掛的版本。 |
| 提示安裝或啟用 `dsh-chat-import` | 在同一設定檔中安裝並啟用 `dsh-chat-import@0.26.6`。若要一起安裝兩個外掛，可將它們放在同一條 `plugin ... add` 指令中。 |
| 路徑不存在或沒有權限 | 檢查 DSH 主機上的絕對路徑，以及執行 DSH 的帳號是否有讀取權限。補充檔案路徑以專案根目錄為起點。 |
| 無法讀取 ChatGPT 檔案，或掃描沒有結果 | 確認 ZIP 內含對話 JSON，或所選 JSON 的最外層是對話陣列，並檢查讀取權限及大小上限。 |
| 找不到 Claude Code 對話 | 指定記錄資料夾或主要對話的 `.jsonl` 檔案，再重新掃描。若 Claude Code 在 WSL、容器或另一台電腦執行，請把記錄放在 DSH 主機可讀取的位置。 |
| 提示來源檔案已變更，或掃描結果、預覽已過期 | 重新掃描或產生預覽。若來源仍在寫入，請等寫入完成後再試。 |
| 對話已開啟，但輸入框沒有填入摘要 | 確認輸入框是否已有草稿或正在傳送。也可在匯入結果中點選 **复制摘要**，再手動貼上。 |

回報問題時，請附上作業系統、DSH 版本、外掛版本、使用的設定檔、已移除敏感資訊的錯誤文字，以及重現步驟。若能用測試對話重現，請優先提供測試檔案。

## 更新與解除安裝

更新時，請下載對應版本的 `.tgz`，使用新檔案的絕對路徑執行相同的 `plugin --profile … add` 指令。更新桌面版前須完全結束程式，更新 Web 版後須重新啟動服務。相依套件版本請以新版安裝說明為準。

若只要移除 Context Bridge，請完全結束 Windows 桌面應用程式，再執行下列指令。

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $dshCli plugin --profile desktop remove dsh-context-bridge
```

Web 版請將指令中的設定檔改為 `web`，並使用啟動 Web 版時的 CLI。已匯入的對話和快照分別由 DSH 的對話儲存空間和本機快照目錄管理。若仍需使用 **导入会话** 功能，可保留 `dsh-chat-import`。

Context Bridge 使用 `dsh-chat-import` 的對話搜尋和匯入服務，並提供專案比對、遷移預覽及接續草稿。 [dsh-chat-import 第三方外掛介面](https://github.com/Nwflower/dsh-chat-import/blob/main/docs/USAGE.md#for-third-party-plugins)
