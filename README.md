# NotebookLM URL Pusher

閲覧中のWebページのURLを、指定したNotebookLMのノートブックに追加するためのChrome拡張です。

ソーシャルブックマーク拡張のような操作感で、裏側でNotebookLMに登録を行います。

## 特徴

- NotebookLMを前面に出さずにURL追加
- ノートブック選択UI付きポップアップ
- ドメインごとの送信先記憶
- 個人利用向け

## 開発・動作確認方法

1. `pnpm install`
2. `pnpm dev`
3. Chromeで `chrome://extensions` を開く
4. デベロッパーモードをON
5. 「パッケージ化されていない拡張機能を読み込む」
6. `pnpm dev` の場合は `.output/chrome-mv3-dev` を指定（`pnpm build` 後は `.output/chrome-mv3`）

## ビルド

- `pnpm build` で本番ビルド
- `pnpm zip` で配布用ZIPを生成

## コマンド一覧

| コマンド | 説明 |
| --- | --- |
| `pnpm dev` | 開発サーバー起動（WXT） |
| `pnpm build` | プロダクションビルド |
| `pnpm zip` | 配布用ZIPの作成 |
| `pnpm typecheck` | TypeScript 型チェック |

## プロジェクト構成（WXT）

```
src/
├ entrypoints/
│  ├ popup/               # ポップアップ
│  │  ├ index.html
│  │  └ main.ts
│  ├ options/             # 設定画面
│  │  ├ index.html
│  │  └ main.ts
│  ├ notebooklm.content.ts # NotebookLM DOM操作
│  └ background.ts         # Service Worker
├ lib/                    # 共有ユーティリティ
└ styles.css              # 共通スタイル
public/
└ icons/                  # 拡張機能アイコン
wxt.config.ts             # WXT/Manifest 設定
```

## デバッグのヒント

- Service Worker ログは `chrome://extensions` の「Service worker」から確認
- NotebookLM タブ側のログは通常の DevTools コンソール

## 技術スタック

- WXT
- TypeScript
- webextension-polyfill

## 開発について

実装仕様・要件は `PROMPT.md` を参照してください。
