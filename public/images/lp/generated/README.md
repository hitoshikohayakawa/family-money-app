# LP生成イラスト（差し替え用スロット）

このフォルダに以下のPNGを生成して置き、
[app/components/landing-page.tsx](../../../../app/components/landing-page.tsx) の
`USE_GENERATED_ILLUSTRATIONS` を `true` にすると、LPの各 lucide アイコンが
生成PNGへ自動で切り替わります（コード修正不要）。

現状（PNG未生成）は lucide-react アイコンで表示しています。絵文字は不使用です。

## 生成ルール（Codex CLI imagegen）

- 文字入り画像禁止 / 日本語禁止
- 新キャラクター禁止・ミラくんの別人化禁止
- 透過PNG / 512x512
- 淡いグリーン・ベージュ・やさしい黄色、清潔感のあるやさしい図解
- 参考世界観: hero-visual / mirakun-happy / mirakun-money / mirakun-study / mirakun-chart

## 必要なファイル

### 悩みカード（02）
- `problem-allowance.png` … おこづかい袋・家計メモ・少し迷う雰囲気
- `problem-investment.png` … グラフ・虫眼鏡・考える雰囲気
- `problem-task.png` … チェックリスト・鉛筆・習慣化

### 体験フロー（03）
- `flow-do.png` … チェックリストと鉛筆（やる）
- `flow-receive.png` … おこづかい袋とコイン（もらう）
- `flow-choose.png` … 分かれ道・選択肢・矢印（選ぶ）
- `flow-learn.png` … 本・ニュース・シンプルな上昇グラフ（学ぶ）

### 投資先アップデート（08）
- `invest-theme-game.png` … ゲームコントローラー
- `invest-theme-car.png` … 車
- `invest-theme-global.png` … 地球・世界
- `invest-theme-entertainment.png` … 音符・映画・エンタメ
- `invest-theme-tech.png` … スマホ・デバイス・テクノロジー
