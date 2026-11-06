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

## 本の向き（棚管理）

本は4通りの向きで置けます（`src/utils/orientation.ts`）。雑貨は向きを選べません。

| 向き | 値 | 見え方 |
| --- | --- | --- |
| 立てる（表紙を向ける） | `standing-cover` | 既定。表紙が手前 |
| 立てる（背表紙を向ける） | `standing-spine` | 背表紙が手前 |
| 寝かせる（表紙が上） | `lying-cover` | 平置き。表紙が上 |
| 寝かせる（背表紙が手前） | `lying-spine` | 平置きで背表紙が手前 |

- 棚管理の左サイドバー「本を置く向き」で選んでから、本をドラッグ&ドロップします。
- 配置済みの本の向きは、サイドバー下の「（面）に配置済み」一覧のプルダウンで後から変えられます。向きで占める寸法が変わるため、接地の高さ・奥行き・左右の範囲は自動で計算し直されます。
- `position` は向きを反映した後の物の中心です。表示に使う回転は `orientation` から算出します（未設定のデータは `standing-cover` 扱い）。
- 本の面の割り当て: 表紙=+z、裏表紙=-z、背表紙=+x（表紙から見て右側＝右綴じ）。
- 店内で商品をクリックして手元に取ると、向きに関係なく表紙が手前に向きます（戻すと元の向きで棚に戻ります）。
- 寝かせた本の重ね置き（平積み）や、物同士の衝突判定はありません。

## 店内（/store/:shopId）の操作

| 操作 | 動き |
| --- | --- |
| ドラッグ（左・右どちらでも） | 視点を回転（平行移動はできません） |
| スクロール / ピンチ | 拡大縮小（距離 0.1〜1.2m） |
| 商品をクリック / タップ | 商品が棚から外れて手元（視点の正面）に拡大表示される。視点操作は止まり、ドラッグで商品を回転できる |
| 「← 棚に戻す」ボタン / Escキー | 商品が棚の元の位置へ戻り、視点操作が再開する |
| VR: 商品を見つめて縦に素早く1往復 / 横に素早く1往復 | 手元に取る / 棚に戻す（クリックの代わり） |

- 視点を動かすドラッグはクリックとして扱いません（動かした距離が約5px以内のときだけクリック）。
- 手元の位置は取り出した瞬間の視点に固定されます。VRで頭を動かしても商品は動かないので、周りから眺められます。
- VRのヘッドセット内ではドラッグ回転・戻るボタンは使えません（戻すのは視線ジェスチャー）。
- 実装: `components/HeldObject.tsx`（手元表示・回転・アニメーション）、`components/PlacedObjects.tsx`（クリック判定・棚側の非表示）、`components/VRStore.tsx`（状態管理・ボタン）。

## データモデル（Firestore）

```
shops/{shopId}                           name, description, isPublic, doorImageUrl?, ownerUid, createdAt
shops/{shopId}/objects/{id}              name, kind('gltf'|'book'), color, sizeCm, gltfUrl? | bookTextures?
shops/{shopId}/placements/{id}           objectId, surface, compartmentIndex, orientation?, position{x,y,z}
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

## トラブルシュート: 「読み込み中…」のまま進まない

ブラウザで F12 → Console を開き、赤いエラーを確認してください（画面にも原因が出ます）。

| 症状・エラー | 原因と対処 |
| --- | --- |
| `permission-denied` | Firestoreのルール未設定。`firestore.rules` をコンソールの「Firestore Database → ルール」に貼って「公開」 |
| `client is offline` / `unavailable` | Firestore Databaseが未作成、`.env` のprojectId/apiKeyの誤り、広告ブロッカーやVPN・社内ネットワークによる遮断 |
| `Firebaseが未設定` と表示される | `.env` が無い/値が空。`.env` を編集したら `npm run dev` を再起動（Viteは起動時にしか読まない） |
| 管理画面だけ「読み込み中…」 | Authentication でメール/パスワードを有効化、`.env` の `VITE_FIREBASE_API_KEY` / `AUTH_DOMAIN` を確認 |

## トラブルシュート: 店内（/store/...）が真っ白になる・商品が箱のまま

3Dの素材（本のテクスチャ・GLB・環境マップ）の読み込みが失敗すると起きます。現在は失敗しても部屋は表示され、商品は単色の箱で代用されます。F12 → Console の赤いエラーで原因を確認してください。

- `blocked by CORS policy`（firebasestorage.googleapis.com）: StorageバケットにCORS設定が必要です。Google Cloud Console右上の「Cloud Shell」を開いて次を実行します（`<バケット名>` は `.env` の `VITE_FIREBASE_STORAGE_BUCKET`）。
  ```
  echo '[{"origin":["*"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
  gsutil cors set cors.json gs://<バケット名>
  ```
- 環境マップ（外部CDN）の取得失敗: 自動で半球ライトに切り替わります。見た目が少し変わるだけで動作には影響しません。

## 注意点・仮定

- **左右の呼び名**: `left` は X<0 の棚（元のVRStoreの "Shelf Left"）。入口から奥を向く来店者には画面の右側に見えます。見た目の左右に合わせたい場合は `roomLayout.ts` の `LEFT_X/RIGHT_X` と回転の符号を入れ替えてください。
- 「壁」は奥の壁（2m×2.5m）です。中央は正面の板が手前にあるため隠れます（正面の板自体は編集対象外）。
- 棚に置いた商品は背板側に寄せて配置されます（奥行き方向は選べません）。同じ区画に複数置いても重なり判定はありません。
- 棚は左右の2台固定です（棚数の増減は未対応）。
- `@react-three/xr` は v6 の API（`createXRStore`）を使用しています。VRセッションは HTTPS と WebXR 対応デバイスが必要です。ヘッドセット内ではHTMLのマニュアルパネルは見えません。
- Storage上の画像/GLTFをThree.jsで読むためには、バケットのCORS設定が必要になることがあります。
- マニュアルの本文は `VRStore.tsx` の `<ManualPanel>` 内（TODOコメント）に記述します。
