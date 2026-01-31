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
6. `.output/chrome-mv3` を指定

## ビルド

- `pnpm build` で本番ビルド
- `pnpm zip` で配布用ZIPを生成

## 開発について

実装仕様・要件は `PROMPT.md` を参照してください。
