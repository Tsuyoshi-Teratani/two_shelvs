# ThoShelfsShop

小さな雑貨屋・書店をWebVRで覗けるサービス。React (TypeScript) + Vite + react-three-fiber + Firebase。

## 起動

```powershell
npm install
copy .env.example .env   # Firebaseの設定値を記入
npm run dev              # http://localhost:5173
npx tsc -b               # 型チェック
```

Firebase Console で Authentication（メール/パスワード）・Firestore・Storage を有効化し、`firestore.rules` を適用してください。
Storage のルール・CORS、スマホ/VR実機でのHTTPS要件は、次の「注意点」を参照。

## ルーティング

| パス | コンポーネント | 内容 |
| --- | --- | --- |
| `/` | `Top.tsx` | 公開店舗のドアをランダムに最大12件（PC: 横4列×縦3段）。ヘッダー（ログイン/新規登録）・フッター付き |
| `/store/:shopId` | `VRStore.tsx` | 店内表示。PCは右ドラッグで視点回転、VRは視線ジェスチャー。`isPublic`がOFFの店は非公開表示 |
| `/regist` | `Regist.tsx` | 店舗登録 |
| `/error` | `ErrorPage.tsx` | エラー/404 |
| `/admin` | `Dashboard.tsx`（`ProtectedRoute`、未ログイン時は`Auth.tsx`） | 管理画面 |
| `/admin/shelves` | `ShelvesManager.tsx` | 棚管理: 壁/左本棚/右本棚をタブで切り替えて、商品・ステッカーをドラッグ&ドロップで配置 |
| `/admin/objects` | `ObjectsManager.tsx` | オブジェクト管理: 雑貨(GLTF)・本(表紙/背表紙/裏表紙を矩形トリミング) |
| `/admin/stickers` | `StickerManager.tsx` | ステッカー管理: 画像 or フリーハンド |
| `/admin/account` | `AccountManager.tsx` | 店舗名・扉デザイン・一般公開可否 |

## 3Dの構成（公開画面と棚編集で共通）

```
src/Size.tsx            1M=1単位。ROOM / FRONT_BOARD / DOOR / SHELF の寸法をここで定義
src/object/Shelf.tsx        本棚（上下2段×左右2列の4区画＋土台＋名前プレート）
src/object/FrontBoard.tsx   正面の板
src/components/StoreRoom.tsx 部屋（壁・床・天井・照明・正面の板・扉・左右の棚）。VRStoreと棚編集の両方で使用
src/utils/shelfLayout.ts    棚の区画計算・配置クランプ（Shelf.tsxのジオメトリと一致させる）
src/utils/roomLayout.ts     左右の棚の配置変換・壁面のクランプ
```

- 部屋: X -1〜1 / Y 0〜2.5 / Z 0（入口の扉）〜2（奥の壁）。来店者は+Z方向を向く。
- 棚のローカル座標の原点は「棚本体の下端・幅中央・奥行き中央」、開口部は+z側。区画番号は `row*2+col`（0=下段左 … 3=上段右）。
- 置き場所は3面: `wall`（奥の壁・ワールド座標）/ `left` / `right`（棚ローカル座標）。
- 奥の壁に置く物・ステッカーは来店者側(-Z)を向くよう180度回して描画する。

## データモデル（Firestore）

```
shops/{shopId}                           name, description, isPublic, doorImageUrl?, ownerUid, createdAt
shops/{shopId}/objects/{id}              name, kind('gltf'|'book'), color, sizeCm, gltfUrl? | bookTextures?
shops/{shopId}/placements/{id}           objectId, surface, compartmentIndex, position{x,y,z}
shops/{shopId}/stickers/{id}             name, imageUrl, isFreehand
shops/{shopId}/stickerPlacements/{id}    stickerId, surface, position, widthM, heightM
```

## テストデータ

`scripts/seed.ts` が、テスト用の店舗・商品・配置・ステッカーを自動で作ります（画像とGLBもスクリプトが生成します）。

```powershell
npm install
npm run seed:dry                 # Firebaseには触れず ./seed-out に書き出して中身を確認（3店舗）
npm run seed -- --key C:\path\to\serviceAccount.json    # Firebaseへ投入（既定14店舗）
npm run seed:clean -- --key C:\path\to\serviceAccount.json   # テストデータだけ削除
```

- サービスアカウントキー: Firebase Console → プロジェクトの設定 → サービスアカウント → 「新しい秘密鍵を生成」。Gitに入れないでください（`.gitignore`済み）。環境変数 `GOOGLE_APPLICATION_CREDENTIALS` でも指定できます。バケット名は `.env` の `VITE_FIREBASE_STORAGE_BUCKET` を使います。
- 店舗数は `--shops 20` のように変更できます。最後の1店舗は非公開です。
- 店舗のuidは `seed-shop-01` …、ログインは `seed-shop-01@example.com` / `ThoShelfs-test1`。
- 1店舗あたり: 本6冊（表紙・背表紙・裏表紙つき）、雑貨2点（GLB）、壁と左右の棚への配置（約7割。残りは未配置）、ステッカー3種と貼り付け4件。3店舗に1店舗は扉画像つき（残りはデフォルトの扉）。
- 配置座標はアプリ本体の `src/utils` の計算関数で求めているため、実際の部屋にそのまま収まります。
- 何度実行しても同じIDを上書きするだけです。実データ（uidが `seed-shop-` で始まらないもの）には触りません。

## 注意点・仮定

- **左右の呼び名**: `left` は X<0 の棚（元のVRStoreの "Shelf Left"）。入口から奥を向く来店者には画面の右側に見えます。見た目の左右に合わせたい場合は `roomLayout.ts` の `LEFT_X/RIGHT_X` と回転の符号を入れ替えてください。
- 「壁」は奥の壁（2m×2.5m）です。中央は正面の板が手前にあるため隠れます（正面の板自体は編集対象外）。
- 棚に置いた商品は背板側に寄せて配置されます（奥行き方向は選べません）。同じ区画に複数置いても重なり判定はありません。
- 棚は左右の2台固定です（棚数の増減は未対応）。
- `@react-three/xr` は v6 の API（`createXRStore`）を使用しています。VRセッションは HTTPS と WebXR 対応デバイスが必要です。ヘッドセット内ではHTMLのマニュアルパネルは見えません。
- Storage上の画像/GLTFをThree.jsで読むためには、バケットのCORS設定が必要になることがあります。
- マニュアルの本文は `VRStore.tsx` の `<ManualPanel>` 内（TODOコメント）に記述します。
