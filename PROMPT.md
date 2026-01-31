# NotebookLM URL Pusher 実装指示書（AI用）

本ドキュメントは、本リポジトリのChrome拡張を実装するための公式仕様書である。
Codexは、本書の内容に厳密に従って実装すること。

---

## 1. 目的

Chromeで閲覧中のNotebookLM以外のWebページURLを、
事前登録されたNotebookLMノートブックに対して
「ウェブサイト / YouTube URL」として追加する拡張機能を作成する。

- ソーシャルブックマーク型のUX
- ユーザー操作起点
- 裏タブ処理
- 画面フォーカスを奪わない
- 個人利用前提
- DOM自動操作は許容

---

## 2. 機能要件

### 2.1 ノートブック登録（Options）

- 設定画面で複数ノートブックを登録できる
- 各データは以下を持つ

```ts
{
  id: string,
  name: string,      // 表示名（省略可）
  url: string,       // 必須
  createdAt: number
}
```

* URL制約

  * origin: [https://notebooklm.google.com](https://notebooklm.google.com)
  * path: /notebook/ で始まること

* 保存先：chrome.storage.sync（key: notebooks）

### ノートブックURLの構造と正規化（重要）

- ノートブックURLは `https://notebooklm.google.com/notebook/<ID>` 形式を前提とする。
- <ID> はUUID形式である可能性が高いが、将来変わる可能性もあるため「/notebook/ の後に1文字以上」を満たせば許可する。
- 保存・比較（既存タブ再利用判定）ではURLを必ず正規化する：
  - `new URL(url)` を使い、`origin + pathname` のみを採用する
  - query（`?`）と hash（`#`）は破棄する
  - 末尾スラッシュの有無は統一する（例：末尾スラッシュは削除）

---

### 2.2 URL送信ポップアップ

* 登録済みノートブックを select で表示
* 表示は name（なければURL）
* 現在のタブURLを表示
* 「このURLを追加」ボタンを設置

#### 無効条件

* chrome://
* chrome-extension://
* about:
* edge://
* [https://notebooklm.google.com/](https://notebooklm.google.com/)*

#### デフォルト選択

* origin単位で前回選択を記憶
* 記録先：lastSelectedByOrigin

---

### 2.3 バックグラウンド処理

* PUSH_URL メッセージを受信
* NotebookLMを裏タブで開く
* 既存タブがあれば再利用
* ロード完了待機
* content.jsへ命令送信
* 自動生成タブは完了後に閉じる

---

### 2.4 NotebookLM自動操作

以下の順で操作すること：

1. 「ソースを追加」をクリック
2. ダイアログ待機
3. 「ウェブサイト」をクリック
4. URL入力欄待機
5. URL入力
6. 「挿入」有効化待機
7. 「挿入」クリック
8. ダイアログ終了待機

---

## 3. データ構造

### notebooks

```ts
Notebook {
  id: string
  name: string
  url: string
  createdAt: number
}
```

### lastSelectedByOrigin

```ts
{
  [origin: string]: notebookId
}
```

---

## 4. システム構成（WXT）

| ファイル                                   | 役割    |
| -------------------------------------- | ----- |
| src/entrypoints/popup/main.ts          | UI制御  |
| src/entrypoints/background.ts          | タブ制御  |
| src/entrypoints/notebooklm.content.ts  | DOM操作 |
| src/entrypoints/options/main.ts        | 登録管理  |

---

## 5. ディレクトリ構成（WXT）

```
src/
├ entrypoints/
│  ├ popup/
│  │  ├ index.html
│  │  └ main.ts
│  ├ options/
│  │  ├ index.html
│  │  └ main.ts
│  ├ notebooklm.content.ts
│  └ background.ts
├ lib/
├ styles.css
public/
└ icons/
wxt.config.ts
```

---

## 6. Manifest仕様（wxt.config.ts）

* manifest_version: 3
* permissions: storage, tabs, scripting
* host_permissions: [https://notebooklm.google.com/](https://notebooklm.google.com/)*
* content_scripts: NotebookLMのみ（`defineContentScript` で指定）

---

## 7. DOMセレクタ（固定）

### ソース追加

```
button.add-source-button[aria-label="ソースを追加"]
```

### ダイアログ

```
mat-dialog-container[role="dialog"]
```

### ウェブサイト

```
.mdc-button__label == "ウェブサイト"
```

### URL入力

```
textarea[formcontrolname="urls"][aria-label="URL を入力"]
```

### 挿入

```
.mdc-button__label == "挿入"
```

## DOM操作の実装注意（重要）

- 動的なID（例: #mat-input-3 など）には依存しないこと。
- 「ウェブサイト」ボタンは、ダイアログ内の button を走査して
  button.querySelector('.mdc-button__label') のテキスト（trim後）が "ウェブサイト" と一致するものをクリックすること。
- URL入力画面は 2段遷移の可能性がある。
  すでに textarea[formcontrolname="urls"] が存在する場合は「ウェブサイト」クリックをスキップしてURL入力へ進む。
- 「挿入」ボタンは初期disabledのため、有効化されるまで待つこと。
  disabled判定は button.hasAttribute('disabled') または button.classList.contains('mat-mdc-button-disabled') を使うこと。

---

## 8. 入力制御

* textarea.value設定
* input/changeイベント発火（bubbles:true必須）

---

## 9. タブ制御

| ケース | 動作                    |
| --- | --------------------- |
| 新規  | active:false → 完了後閉じる |
| 再利用 | 閉じない                  |

---

## 10. エラー処理

* waitForはtimeout必須
* 失敗時は理由を返す
* Workerを停止させない

---

## 11. 品質基準

* 外部ライブラリ禁止
* Pure JS
* 安全なDOM探索
* console.log整備

---

## 12. 受け入れ条件

1. 登録可能
2. ポップアップ表示
3. 履歴保存
4. 裏処理成功
5. フォーカス不変
6. タブ整理
7. エラー表示

---

以上を厳守して実装すること。
