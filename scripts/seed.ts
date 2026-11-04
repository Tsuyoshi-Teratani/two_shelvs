/**
 * テストデータ投入スクリプト。
 *
 *   npm run seed                 Firebaseへ投入（要: サービスアカウントキー）
 *   npm run seed:clean           投入済みのテストデータを削除
 *   npm run seed -- --dry-run    Firebaseには触れず ./seed-out に生成物を書き出す（画像・GLB・JSONの確認用）
 *
 * オプション: --shops 14（店舗数。最後の1店は非公開）  --key path/to/serviceAccount.json
 *
 * 生成するもの（店舗ごと）:
 *   Authユーザー / shops / objects(本6冊+雑貨2点、テクスチャ・GLBも生成してStorageへ) /
 *   placements(壁・左右の棚に配置。一部は未配置のまま) / stickers(3種) / stickerPlacements
 * 配置座標は、アプリ本体と同じ src/utils の計算関数で求めているので、実際の部屋にそのまま収まります。
 * テスト店舗のuidは "seed-shop-NN"、ログインは seed-shop-NN@example.com / ThoShelfs-test1
 */
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { getShelfLayout, clampToCompartment, sizeCmToMeters } from '../src/utils/shelfLayout';
import { clampToWall, clampStickerToWall, clampStickerToShelfBack } from '../src/utils/roomLayout';
import type {
  PlacementDoc,
  ShopDoc,
  StickerDoc,
  StickerPlacementDoc,
  StoreObjectDoc,
} from '../src/types';

// ---------------------------------------------------------------- 設定 / 引数

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const val = (flag: string, fallback?: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};

const CLEAN = has('--clean');
const DRY = has('--dry-run');
const SHOPS = Math.max(1, Number(val('--shops', '14')));
const KEY_PATH = val('--key', process.env.GOOGLE_APPLICATION_CREDENTIALS);

const UID_PREFIX = 'seed-shop-';
const PASSWORD = 'ThoShelfs-test1';
const OUT_DIR = path.join(process.cwd(), 'seed-out');

const SHOP_NAMES = [
  'ふしぎ雑貨店', '月明かり書房', 'まめ書店', 'ことり堂', '紙と珈琲', '青い栞', 'くじら文庫',
  'windmill books', '小さな標本室', '夜更かし古書店', 'ミモザ雑貨', 'ひだまり文具店', 'ポケット図書館', '路地裏の本棚',
];
const BOOK_TITLES = [
  '星の図鑑', '夜の旅人', 'はちみつ色の午後', '森のレシピ', '海辺の手紙', '古い地図の話', '雨の日の物語', '風のノート',
];

// ---------------------------------------------------------------- 乱数・色

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

function hsl(h: number, s: number, l: number): RGB {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255)) as RGB;
}
const opaque = (c: RGB): RGBA => [c[0], c[1], c[2], 255];

// ---------------------------------------------------------------- PNG生成（外部ライブラリなし）

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeImage(w: number, h: number, px: (x: number, y: number) => RGBA): Buffer {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // フィルタなし
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y);
      const i = y * stride + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 本のテクスチャ（表紙 420x600 / 背表紙 120x600 / 裏表紙 420x600。アプリ側のトリミング出力サイズと同じ）

function coverPng(hue: number, variant: number) {
  const W = 420, H = 600;
  return makeImage(W, H, (x, y) => {
    if (x < 14 || x >= W - 14 || y < 14 || y >= H - 14) return opaque(hsl(hue, 0.45, 0.88));
    const dx = x - W / 2, dy = y - H * 0.4;
    let outer = false, inner = false;
    if (variant === 0) { const d = Math.hypot(dx, dy); outer = d < 120; inner = d < 85; }
    else if (variant === 1) { outer = Math.abs(dx) < 110 && Math.abs(dy) < 110; inner = Math.abs(dx) < 78 && Math.abs(dy) < 78; }
    else { const d = Math.abs(dx) + Math.abs(dy); outer = d < 150; inner = d < 105; }
    if (inner) return opaque(hsl(hue + 35, 0.65, 0.55));
    if (outer) return opaque(hsl(hue, 0.5, 0.88));
    if (y > H * 0.72 && y < H * 0.72 + 16 && x > 60 && x < W - 60) return opaque(hsl(hue, 0.5, 0.9));
    if (y > H * 0.72 + 36 && y < H * 0.72 + 48 && x > 110 && x < W - 110) return opaque(hsl(hue, 0.5, 0.8));
    return opaque(hsl(hue, 0.55, 0.3 + 0.22 * (1 - y / H)));
  });
}

function spinePng(hue: number) {
  const W = 120, H = 600;
  return makeImage(W, H, (x, y) => {
    if (x < 6 || x >= W - 6) return opaque(hsl(hue, 0.5, 0.2));
    if ((y > 40 && y < 52) || (y > H - 52 && y < H - 40)) return opaque(hsl(hue, 0.5, 0.88));
    if (Math.abs(x - W / 2) < 22 && Math.abs(y - H / 2) < 22) return opaque(hsl(hue + 35, 0.65, 0.6));
    return opaque(hsl(hue, 0.55, 0.3));
  });
}

function backPng(hue: number) {
  const W = 420, H = 600;
  return makeImage(W, H, (x, y) => {
    if (x > W - 170 && x < W - 30 && y > H - 120 && y < H - 40) {
      return x % 6 < 3 ? [20, 20, 20, 255] : [245, 245, 245, 255]; // バーコード風
    }
    const row = Math.floor((y - 80) / 28);
    if (y >= 80 && y < 80 + 28 * 8 && (y - 80) % 28 < 10 && x > 50 && x < W - 50 - (row % 3) * 50) {
      return opaque(hsl(hue, 0.4, 0.75));
    }
    return opaque(hsl(hue, 0.4, 0.26));
  });
}

// ---- 扉（240x360）

function doorPng(hue: number) {
  const W = 240, H = 360;
  return makeImage(W, H, (x, y) => {
    if (x < 12 || x >= W - 12 || y < 12 || y >= H - 12) return opaque(hsl(hue, 0.4, 0.2));
    if (Math.hypot(x - 217, y - 190) < 8) return [214, 174, 72, 255]; // 取っ手
    const panel = x > 34 && x < W - 40 && ((y > 34 && y < 150) || (y > 180 && y < H - 34));
    if (panel) return opaque(hsl(hue, 0.45, 0.42));
    return opaque(hsl(hue, 0.45, 0.33));
  });
}

// ---- ステッカー（256x256、背景透明）

function pointInPolygon(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function starPng(color: RGB) {
  const S = 256;
  const poly: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 120 : 50;
    poly.push([128 + r * Math.cos(a), 132 + r * Math.sin(a)]);
  }
  return makeImage(S, S, (x, y) => (pointInPolygon(x, y, poly) ? opaque(color) : [0, 0, 0, 0]));
}

function badgePng(hue: number) {
  const S = 256;
  return makeImage(S, S, (x, y) => {
    const d = Math.hypot(x - 128, y - 128);
    if (d >= 118) return [0, 0, 0, 0];
    if (d >= 100) return [255, 255, 255, 255];
    if (d < 55) return opaque(hsl(hue, 0.7, 0.88));
    return opaque(hsl(hue, 0.7, 0.5));
  });
}

/** 手描き風のうずまき（フリーハンドステッカーの見本） */
function scribblePng() {
  const S = 256;
  const mask = new Uint8Array(S * S);
  for (let th = 0; th < 6 * Math.PI; th += 0.02) {
    const r = th * 6 + Math.sin(th * 3) * 4;
    const cx = 128 + r * Math.cos(th), cy = 128 + r * Math.sin(th);
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const x = Math.round(cx + dx), y = Math.round(cy + dy);
        if (dx * dx + dy * dy <= 25 && x >= 0 && x < S && y >= 0 && y < S) mask[y * S + x] = 1;
      }
    }
  }
  return makeImage(S, S, (x, y) => (mask[y * S + x] ? [43, 47, 56, 255] : [0, 0, 0, 0]));
}

// ---------------------------------------------------------------- GLB生成（回転体の簡易モデル）

/** profile は [半径, 高さ] の列（下→上）。アプリ側が高さ(sizeCm.h)に合わせて自動スケールする */
function lathe(profile: [number, number][], segments = 24) {
  const n = profile.length;
  const segNormals: [number, number][] = [];
  for (let k = 0; k < n - 1; k++) {
    const dr = profile[k + 1][0] - profile[k][0];
    const dy = profile[k + 1][1] - profile[k][1];
    const len = Math.hypot(dy, dr) || 1;
    segNormals.push([dy / len, -dr / len]); // 断面上の外向き法線
  }
  const positions: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = segNormals[Math.max(0, i - 1)], b = segNormals[Math.min(n - 2, i)];
    let nr = a[0] + b[0], ny = a[1] + b[1];
    const l = Math.hypot(nr, ny) || 1;
    nr /= l; ny /= l;
    for (let j = 0; j <= segments; j++) {
      const phi = (j / segments) * Math.PI * 2;
      positions.push(profile[i][0] * Math.cos(phi), profile[i][1], profile[i][0] * Math.sin(phi));
      normals.push(nr * Math.cos(phi), ny, nr * Math.sin(phi));
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j, b = a + 1, c = a + segments + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions, normals, indices };
}

function pad4(buf: Buffer, fill = 0) {
  const rest = (4 - (buf.length % 4)) % 4;
  return rest ? Buffer.concat([buf, Buffer.alloc(rest, fill)]) : buf;
}

function buildGlb(profile: [number, number][], color: RGB): Buffer {
  const { positions, normals, indices } = lathe(profile);
  const pos = Buffer.from(new Float32Array(positions).buffer);
  const nor = Buffer.from(new Float32Array(normals).buffer);
  const idx = pad4(Buffer.from(new Uint16Array(indices).buffer));
  const count = positions.length / 3;
  const min = [0, 1, 2].map((k) => Math.min(...positions.filter((_, i) => i % 3 === k)));
  const max = [0, 1, 2].map((k) => Math.max(...positions.filter((_, i) => i % 3 === k)));

  const json = {
    asset: { version: '2.0', generator: 'thoshelfsshop-seed' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [color[0] / 255, color[1] / 255, color[2] / 255, 1],
          metallicFactor: 0.1,
          roughnessFactor: 0.7,
        },
        doubleSided: true,
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.length, target: 34962 },
      { buffer: 0, byteOffset: pos.length, byteLength: nor.length, target: 34962 },
      { buffer: 0, byteOffset: pos.length + nor.length, byteLength: indices.length * 2, target: 34963 },
    ],
    buffers: [{ byteLength: pos.length + nor.length + idx.length }],
  };

  const bin = Buffer.concat([pos, nor, idx]);
  const jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonBuf.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHead, jsonBuf, binHead, bin]);
}

const CANDLE_PROFILE: [number, number][] = [[0, 0], [0.5, 0], [0.52, 0.03], [0.52, 0.94], [0.5, 1], [0, 1]];
const VASE_PROFILE: [number, number][] = [[0, 0], [0.3, 0], [0.45, 0.2], [0.5, 0.45], [0.38, 0.75], [0.18, 0.88], [0.2, 1], [0, 1]];

// ---------------------------------------------------------------- 書き込み先（Firebase / ドライラン）

interface Sink {
  upload(storagePath: string, data: Buffer, contentType: string): Promise<string>;
  set(docPath: string, data: object): Promise<void>;
  user(uid: string, email: string, displayName: string): Promise<void>;
  finish(): Promise<void>;
}

function dryRunSink(): Sink {
  const docs: Record<string, object> = {};
  const users: object[] = [];
  return {
    async upload(storagePath, data) {
      const file = path.join(OUT_DIR, 'storage', storagePath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
      return `seed-out/storage/${storagePath}`;
    },
    async set(docPath, data) {
      docs[docPath] = data;
    },
    async user(uid, email, displayName) {
      users.push({ uid, email, password: PASSWORD, displayName });
    },
    async finish() {
      fs.writeFileSync(path.join(OUT_DIR, 'firestore.json'), JSON.stringify(docs, null, 2));
      fs.writeFileSync(path.join(OUT_DIR, 'users.json'), JSON.stringify(users, null, 2));
    },
  };
}

function loadEnvFile(): Record<string, string> {
  const file = path.join(process.cwd(), '.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// firebase-admin は Firebase へ書くときだけ読み込む（ドライランでは不要）
async function initAdmin() {
  const env = loadEnvFile();
  const bucketName = process.env.STORAGE_BUCKET ?? env.VITE_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('Storageのバケット名がありません。.env の VITE_FIREBASE_STORAGE_BUCKET を設定してください。');
  if (!KEY_PATH) {
    throw new Error('サービスアカウントキーが必要です。--key path/to/serviceAccount.json か GOOGLE_APPLICATION_CREDENTIALS を指定してください。');
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getStorage } = await import('firebase-admin/storage');
  const serviceAccount = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  initializeApp({ credential: cert(serviceAccount), storageBucket: bucketName });
  return { auth: getAuth(), db: getFirestore(), bucket: getStorage().bucket() };
}

type Admin = Awaited<ReturnType<typeof initAdmin>>;

function firebaseSink({ auth, db, bucket }: Admin): Sink {
  return {
    async upload(storagePath, data, contentType) {
      const token = randomUUID();
      await bucket.file(storagePath).save(data, {
        contentType,
        resumable: false,
        metadata: { metadata: { firebaseStorageDownloadTokens: token } },
      });
      // クライアントSDKの getDownloadURL と同じ形式のURL
      return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
    },
    async set(docPath, data) {
      await db.doc(docPath).set(data);
    },
    async user(uid, email, displayName) {
      const props = { email, password: PASSWORD, displayName, emailVerified: true };
      try {
        await auth.createUser({ uid, ...props });
      } catch (e: any) {
        if (e?.code === 'auth/uid-already-exists' || e?.code === 'auth/email-already-exists') {
          await auth.updateUser(uid, props);
        } else {
          throw e;
        }
      }
    },
    async finish() {},
  };
}

// ---------------------------------------------------------------- 店舗ごとのデータ生成

const LAYOUT = getShelfLayout();

// 棚の区画の使用順。左右・上下に散らす
const SLOT_ORDER: ['left' | 'right', number][] = [
  ['left', 2], ['right', 2], ['left', 0], ['right', 0], ['left', 3], ['right', 3], ['left', 1], ['right', 1],
];

async function seedShop(sink: Sink, index: number) {
  const nn = String(index + 1).padStart(2, '0');
  const uid = `${UID_PREFIX}${nn}`;
  const base = `shops/${uid}`;
  const rand = mulberry32(index * 7919 + 13);
  const shopHue = (index * 37) % 360;
  const isPublic = !(SHOPS > 1 && index === SHOPS - 1); // 最後の1店は非公開
  const name = isPublic ? SHOP_NAMES[index % SHOP_NAMES.length] : '（非公開）テスト店';

  await sink.user(uid, `${uid}@example.com`, name);

  // 扉: 3店舗に1店舗だけ画像を設定（残りはデフォルトのSVGドアになる）
  let doorImageUrl: string | undefined;
  if (index % 3 === 0) {
    doorImageUrl = await sink.upload(`${base}/door.png`, doorPng(shopHue), 'image/png');
  }

  const shop: ShopDoc = {
    id: uid,
    ownerUid: uid,
    name,
    description: `${name}のテストデータです。本と雑貨を少しだけ並べています。`,
    isPublic,
    createdAt: Date.now(),
    ...(doorImageUrl ? { doorImageUrl } : {}),
  };
  await sink.set(base, shop);

  // --- オブジェクト: 本6冊（3枚のテクスチャ付き）＋ 雑貨2点（GLB） ---
  const objects: StoreObjectDoc[] = [];
  for (let i = 0; i < 6; i++) {
    const id = `obj-book-${i + 1}`;
    const hue = (shopHue + i * 47) % 360;
    const dir = `${base}/objects/${id}`;
    const [coverUrl, spineUrl, backUrl] = await Promise.all([
      sink.upload(`${dir}/cover.png`, coverPng(hue, i % 3), 'image/png'),
      sink.upload(`${dir}/spine.png`, spinePng(hue), 'image/png'),
      sink.upload(`${dir}/back.png`, backPng(hue), 'image/png'),
    ]);
    const round1 = (v: number) => Math.round(v * 10) / 10;
    objects.push({
      id,
      name: BOOK_TITLES[(index + i) % BOOK_TITLES.length],
      kind: 'book',
      color: `hsl(${hue}, 55%, 45%)`,
      sizeCm: { w: round1(10 + rand() * 4), h: round1(16 + rand() * 8), d: round1(2 + rand() * 2) },
      category: '本',
      bookTextures: { coverUrl, spineUrl, backUrl },
      createdAt: Date.now(),
    });
  }
  const goods: { id: string; name: string; profile: [number, number][]; color: RGB; size: { w: number; h: number; d: number } }[] = [
    { id: 'obj-goods-1', name: 'キャンドルジャー', profile: CANDLE_PROFILE, color: hsl(shopHue + 20, 0.5, 0.62), size: { w: 8, h: 9, d: 8 } },
    { id: 'obj-goods-2', name: 'ミニ花瓶', profile: VASE_PROFILE, color: hsl(shopHue + 160, 0.45, 0.5), size: { w: 9, h: 20, d: 9 } },
  ];
  for (const g of goods) {
    const gltfUrl = await sink.upload(`${base}/objects/${g.id}/model.glb`, buildGlb(g.profile, g.color), 'model/gltf-binary');
    objects.push({
      id: g.id,
      name: g.name,
      kind: 'gltf',
      color: `rgb(${g.color.join(',')})`,
      sizeCm: g.size,
      category: '雑貨',
      gltfUrl,
      createdAt: Date.now(),
    });
  }
  for (const o of objects) await sink.set(`${base}/objects/${o.id}`, o);

  // --- 配置: 約7割を置き、残りは未配置（棚管理の一覧に残る）。1つは奥の壁、他は左右の棚 ---
  const shuffled = [...objects].sort(() => rand() - 0.5);
  const toPlace = shuffled.slice(0, Math.ceil(objects.length * 0.7));
  const placements: PlacementDoc[] = [];

  const wallItem = toPlace.find((o) => o.kind === 'book');
  if (wallItem) {
    const pos = clampToWall(sizeCmToMeters(wallItem.sizeCm), (index % 2 === 0 ? -1 : 1) * 0.6, 1.4);
    placements.push({ id: `placement-${wallItem.id}`, objectId: wallItem.id, surface: 'wall', compartmentIndex: 0, position: pos });
  }

  const queue = toPlace.filter((o) => o !== wallItem);
  const maxPerCompartment = index % 2 === 0 ? 1 : 2; // 店舗ごとに「1区画1点」と「1区画2点」を混ぜる
  for (const [surface, ci] of SLOT_ORDER) {
    if (queue.length === 0) break;
    const c = LAYOUT.compartments[ci];
    let cursor = c.xMin + 0.01;
    let placed = 0;
    while (queue.length > 0 && placed < maxPerCompartment) {
      const o = queue[0];
      const sz = sizeCmToMeters(o.sizeCm);
      if (cursor + sz.w > c.xMax - 0.005) break;
      const pos = clampToCompartment(LAYOUT, ci, sz, cursor + sz.w / 2);
      placements.push({ id: `placement-${o.id}`, objectId: o.id, surface, compartmentIndex: ci, position: pos });
      cursor += sz.w + 0.01;
      placed++;
      queue.shift();
    }
  }
  for (const p of placements) await sink.set(`${base}/placements/${p.id}`, p);

  // --- ステッカー: 星・バッジ・手描き風 ---
  const stickerSpecs: { id: string; name: string; png: Buffer; isFreehand: boolean }[] = [
    { id: 'sticker-1', name: '星', png: starPng(hsl(shopHue + 50, 0.85, 0.58)), isFreehand: false },
    { id: 'sticker-2', name: 'おすすめバッジ', png: badgePng(shopHue + 200), isFreehand: false },
    { id: 'sticker-3', name: '手描きのうずまき', png: scribblePng(), isFreehand: true },
  ];
  const stickers: StickerDoc[] = [];
  for (const s of stickerSpecs) {
    const imageUrl = await sink.upload(`${base}/stickers/${s.id}.png`, s.png, 'image/png');
    const doc: StickerDoc = { id: s.id, name: s.name, imageUrl, isFreehand: s.isFreehand, createdAt: Date.now() };
    stickers.push(doc);
    await sink.set(`${base}/stickers/${s.id}`, doc);
  }

  const W = 0.3;
  const stickerPlacements: StickerPlacementDoc[] = [
    { stickerId: 'sticker-1', surface: 'wall', position: clampStickerToWall(W, W, -0.6, 1.9), widthM: W, heightM: W },
    { stickerId: 'sticker-2', surface: 'wall', position: clampStickerToWall(W, W, 0.6, 1.9), widthM: W, heightM: W },
    { stickerId: 'sticker-3', surface: 'left', position: clampStickerToShelfBack(0.25, 0.25, 0, 0.9), widthM: 0.25, heightM: 0.25 },
    { stickerId: 'sticker-1', surface: 'right', position: clampStickerToShelfBack(0.2, 0.2, 0, 0.6), widthM: 0.2, heightM: 0.2 },
  ].map((p, k) => ({ id: `sticker-placement-${k + 1}`, ...p }));
  for (const p of stickerPlacements) await sink.set(`${base}/stickerPlacements/${p.id}`, p);

  console.log(
    `  ${uid}  ${isPublic ? '公開  ' : '非公開'}  ${name}  ` +
      `(商品${objects.length} / 配置${placements.length} / ステッカー${stickers.length}・貼付${stickerPlacements.length})`
  );
}

// ---------------------------------------------------------------- クリーン

async function clean(admin: Admin) {
  const { auth, db, bucket } = admin;
  const uids = new Set<string>();

  let pageToken: string | undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    res.users.filter((u) => u.uid.startsWith(UID_PREFIX)).forEach((u) => uids.add(u.uid));
    pageToken = res.pageToken;
  } while (pageToken);
  (await db.collection('shops').listDocuments()).filter((d) => d.id.startsWith(UID_PREFIX)).forEach((d) => uids.add(d.id));

  console.log(`テストデータを削除します（${uids.size}店舗）`);
  for (const uid of uids) {
    await db.recursiveDelete(db.doc(`shops/${uid}`));
    await bucket.deleteFiles({ prefix: `shops/${uid}/` });
    try {
      await auth.deleteUser(uid);
    } catch {
      /* ユーザーが無ければ無視 */
    }
    console.log(`  deleted ${uid}`);
  }
}

// ---------------------------------------------------------------- main

async function main() {
  if (DRY) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    const sink = dryRunSink();
    console.log(`[dry-run] ${SHOPS}店舗ぶんを ./seed-out に書き出します`);
    for (let i = 0; i < SHOPS; i++) await seedShop(sink, i);
    await sink.finish();
    console.log('完了: seed-out/firestore.json, users.json, storage/ を確認してください');
    return;
  }

  const admin = await initAdmin();
  if (CLEAN) {
    await clean(admin);
    return;
  }
  const sink = firebaseSink(admin);
  console.log(`${SHOPS}店舗のテストデータを投入します（既存の seed-shop-* は上書き）`);
  for (let i = 0; i < SHOPS; i++) await seedShop(sink, i);
  console.log(`完了。ログイン例: ${UID_PREFIX}01@example.com / ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
