# DSH Context Bridge

[简体中文](README.md) · [English](README.en.md)

DSH Context Bridge は、選択した ChatGPT と Claude Code の会話を DeepSeek Harness（DSH）のワークスペースに取り込むプラグインです。既存のプロジェクトフォルダーを指定し、関連する会話と引き継ぎ要約を確認できます。取り込んだ会話を開くか、プロジェクト用の下書きから作業を再開できます。

[インストール](#インストール) · [ファイルの準備](#ファイルの準備) · [インポートと作業の再開](#インポートと作業の再開) · [トラブルシューティング](#トラブルシューティング) · [更新とアンインストール](#更新とアンインストール)

## インストール

この手順は Context Bridge `0.1.1` と、依存プラグインの `dsh-chat-import@0.26.6` を対象としています。両方を同じ DSH プロファイルに導入してください。`desktop` と `web` はそれぞれ別にプラグインを管理します。

| DSH 環境 | Windows での動作確認 | プロファイル |
| --- | --- | --- |
| デスクトップ版 | DSH `0.2.2-rc.3` でインストール、スキャン、プレビューを確認 | `desktop` |
| Web 版 | npm CLI `0.2.2-rc.1` とデスクトップ版付属 CLI `0.2.2-rc.3` でインポート、ワークスペースへの振り分け、引き継ぎ用の下書きを確認 | `web` |

[GitHub Releases](https://github.com/GibouLJB/dsh-context-bridge/releases) から `dsh-context-bridge-0.1.1.tgz` を取得するか、[ソースからパッケージを作成](#ソースからパッケージを作成)します。以下の PowerShell コマンドは、パッケージを保存したフォルダーで実行してください。

### Windows デスクトップ版

1. DeepSeek Harness デスクトップ版を一度起動し、`desktop` プロファイルを初期化します。
2. アプリメニューの終了項目、またはシステムトレイから DSH を終了します。ウィンドウの **×** で閉じても、バックグラウンドで動作を続ける場合があります。 [DeepSeek Harness デスクトップ版のドキュメント](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md)
3. PowerShell で次のコマンドを実行します。別の場所に DSH をインストールした場合は、`$dshCli` を付属の `dsh.cmd` のパスに変更してください。

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

& $dshCli --version
& $dshCli plugin --profile desktop add 'dsh-chat-import@0.26.6' "file:$packagePath"
```

DSH を起動し、左サイドバーの下部に **项目迁移**（プロジェクトの移行）が表示されることを確認します。アプリメニューから CLI を登録した場合は、新しい PowerShell ウィンドウで `Get-Command dsh` を実行すると、`dsh` コマンドの参照先を確認できます。

### DSH Web 版

Windows では、デスクトップ版付属の CLI で Web プロファイルにインストールし、起動できます。

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

& $dshCli plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
& $dshCli web
```

npm 版の DSH `0.2.2-rc.1` を使う場合は Node.js `24.9.0` 以降が必要です。事前に `pnpm --version` が実行できることを確認してください。 [DeepSeek Harness Web 版の起動手順](https://github.com/deepseek-ai/deepseek-harness#run-from-npm)

```powershell
$packagePath = (Resolve-Path -LiteralPath '.\dsh-context-bridge-0.1.1.tgz').Path.Replace('\', '/')

npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' plugin --profile web add 'dsh-chat-import@0.26.6' "file:$packagePath"
npx.cmd --yes '@deepseek-ai/dsh@0.2.2-rc.1' web
```

DSH Web がすでに動作している場合は、一度停止してから起動し直し、ターミナルに表示された URL を開いてください。

### ソースからパッケージを作成

リポジトリのルートで、Windows なら `npm.cmd pack`、macOS または Linux なら `npm pack` を実行します。`v0.1.1` のソースからは `dsh-context-bridge-0.1.1.tgz` が生成されます。上記の動作確認は Windows で行いました。

## ファイルの準備

- **ChatGPT**。会話データが手元にない場合は、ChatGPT の設定から **データコントロール → データをエクスポート** を選びます。ダウンロードした ZIP を展開し、`conversations.json` または番号付きの会話 JSON ファイルを探してください。1 回のスキャンで指定できるのは 1 ファイルです。複数ファイルに分かれている場合は、回を分けて取り込みます。 [OpenAI のデータエクスポート手順](https://help.openai.com/ja-jp/articles/7260999-exporting-your-chatgpt-history-and-data)
- **Claude Code**。**扫描 Claude Code**（Claude Code をスキャン）をオンにします。入力欄を空にすると既定の保存先を検索します。通常、Windows では `%USERPROFILE%\.claude\projects`、macOS または Linux では `~/.claude/projects` です。対象を絞る場合は、プロジェクトのログフォルダーまたはメインセッションの `.jsonl` ファイルを絶対パスで指定します。 [dsh-chat-import の使い方](https://github.com/Nwflower/dsh-chat-import/blob/main/docs/USAGE.md)
- **プロジェクトフォルダー**。作業を再開したい既存のフォルダーを指定します。DSH はその場所をワークスペースのルートとして使います。リモートの Web 版を利用する場合は、DSH が動くホスト上のパスを指定し、その実行アカウントでファイルを読み取れることを確認してください。

## インポートと作業の再開

v0.1.1 のプラグイン画面は中国語表示です。以下の手順では、画面に表示される項目名と日本語訳を併記します。

1. **项目迁移**（プロジェクトの移行）を開き、**本地项目目录**（ローカルのプロジェクトフォルダー）と、ChatGPT・Claude Code のいずれか一方または両方のデータを指定します。必要に応じて **项目关键词**（プロジェクトのキーワード）にカンマ区切りで語句を入力します。**补充项目文件**（追加のプロジェクトファイル）には、プロジェクトルートからの相対パスを 1 行につき 1 件入力します。
2. **扫描会话**（会話をスキャン）をクリックします。作業フォルダー、プロジェクト名、会話タイトル、キーワードから候補が表示されます。取り込む会話を 1〜12 件選んでください。自動で選ばれなかった会話も検索できます。
3. **预览迁移**（移行をプレビュー）で、移行先、選択した会話、関連ファイル、引き継ぎ要約を確認します。要約には、目標、決定事項、進捗に関する記述、次の作業とその出典が含まれます。長い会話は一部を抽出するため、進捗は実際のプロジェクトと照らし合わせてください。
4. **导入 N 个会话**（N 件の会話をインポート）をクリックします。指定したフォルダーのワークスペースが作成または再利用され、会話ごとの結果が表示されます。振り分けの警告やエラーが表示された場合は、その内容を確認してからやり直してください。
5. **打开项目并续接**（プロジェクトを開いて再開）をクリックすると、引き継ぎ用の会話に要約が下書きとして入ります。取り込んだ会話の続きを開くには **打开并填入续接草稿**（会話を開いて下書きを入力）を使います。入力欄に既存の下書きがある場合や送信中の場合は、**复制摘要**（要約をコピー）で必要な箇所に手動で貼り付けられます。

スキャン、プレビュー、インポート、下書きの入力は DSH ホストで行われ、モデルの API キーは不要です。内容を確認し、設定済みのモデルを選んで送信してください。 [DSH のモデル設定](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md)

## データの保存と制限

- インポートは一方向で、選択した会話をバッチ単位で取り込みます。元のファイルが変更された場合は、再スキャンしてプレビューを作り直してください。スキャン結果とプレビューの有効時間は約 20 分です。会話ファイルの上限は 1 ファイルあたり 256 MiB です。
- ChatGPT からは会話のメインブランチを取り込みます。添付ファイルを復元できるかどうかは、エクスポートの内容と `dsh-chat-import` の対応状況によって変わります。
- 追加ファイルはワークスペースのフォルダー内に置いてください。Skills、MCP、Hooks は検出した設定ファイルの場所をプレビューに表示します。
- インポートした会話は DSH のセッションストレージに保存されます。重複インポートを識別するため、選択した ChatGPT 会話のスナップショットも `$DSH_HOME/dsh-context-bridge/chatgpt` に保存されます。`DSH_HOME` が未設定の場合は、ホームフォルダーの `.dsh` が使われます。スナップショットには会話本文が含まれます。ログを共有したり Issue を作成したりする際は、非公開のパス、会話内容、機密情報を伏せてください。

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| PowerShell で `dsh` が見つからない | [付属 CLI のフルパス](#windows-デスクトップ版)を使います。登録直後なら新しい PowerShell ウィンドウを開いてください。 |
| パッケージのパスを解決できない | `.tgz` を保存したフォルダーでコマンドを実行するか、`file:` に絶対パスを指定してください。 |
| デスクトッププロファイルがない、または使用中と表示される | 一度デスクトップ版を起動し、アプリメニューから完全に終了してからインストールします。 |
| **项目迁移** が表示されない | 現在のプロファイルで両方のプラグインが有効か確認し、デスクトップ版または Web 版を再起動します。 |
| pnpm がピア依存関係の警告を出す | インストールの終了ステータスと、DSH で両プラグインが読み込まれたかを確認します。 |
| ChatGPT の JSON が読み込めない、または候補がない | 展開済みの会話 JSON を使っているか、トップレベルが配列か、サイズが上限以内か、DSH ホストから読めるかを確認します。 |
| Claude Code の会話が見つからない | セッションの保存フォルダーまたはメインセッションの `.jsonl` を直接指定します。WSL、コンテナ、別のマシンでは、DSH ホストからログにアクセスできるようにしてください。 |
| 元ファイルが変更された、またはプレビューの有効期限が切れた | 書き込みが終わってから、表示された案内に従ってスキャンまたはプレビューをやり直します。 |
| 会話を開いても要約が入力されない | 既存の下書きや送信中のメッセージを確認します。**复制摘要**（要約をコピー）で手動入力できます。 |

不具合を報告する場合は、OS、DSH とプラグインのバージョン、対象プロファイル、機密情報を除いたエラーメッセージ、再現手順を添えてください。

## 更新とアンインストール

更新する場合は、該当するインストールコマンドで新しい `.tgz` の絶対パスを指定します。デスクトップ版は更新前に終了し、Web 版は更新後に再起動してください。

デスクトップ版から Context Bridge を削除する場合は、アプリを終了して付属の CLI で次のコマンドを実行します。

```powershell
$dshCli = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $dshCli plugin --profile desktop remove dsh-context-bridge
```

Web 版では、起動に使っている CLI で `--profile web` を指定してください。取り込んだ会話とローカルのスナップショットは別途管理します。会話のインポート機能を引き続き使う場合は、`dsh-chat-import` を残せます。
