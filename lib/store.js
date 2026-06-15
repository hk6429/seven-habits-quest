import { Redis } from "@upstash/redis";

// Vercel Marketplace 的 Upstash 整合會塞 UPSTASH_REDIS_REST_*；
// 舊版 Vercel KV 用 KV_REST_API_*。兩者都接受。
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const studentKey = (cls, seat) => `student:${cls}-${String(seat).padStart(2, "0")}`;
const googleKey = (sub) => `google:${sub}`;

async function scanKeys(match) {
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, { match, count: 1000 });
    keys.push(...batch);
    cursor = next;
  } while (cursor !== "0");
  return keys;
}

async function mget(keys) {
  if (!keys.length) return [];
  const vals = await redis.mget(...keys);
  return vals.filter(Boolean);
}

export async function loadStudent(cls, seat) {
  return (await redis.get(studentKey(cls, seat))) || null;
}

export async function saveStudent(record) {
  record.updatedAt = new Date().toISOString();
  await redis.set(studentKey(record.cls, record.seat), record);
  return record;
}

// ---------- Google 綁定 ----------

export async function loadGoogleBind(sub) {
  return (await redis.get(googleKey(sub))) || null;
}

export async function saveGoogleBind(sub, cls, seat) {
  await redis.set(googleKey(sub), { cls, seat });
}

// ---------- 全班讀取 ----------

export async function loadAllStudents() {
  return mget(await scanKeys("student:*"));
}

// ---------- 屆歸檔 ----------

export async function listCohorts() {
  const keys = await scanKeys("archive:*");
  const labels = new Set();
  for (const k of keys) {
    const m = /^archive:([^:]+):/.exec(k);
    if (m) labels.add(m[1]);
  }
  return [...labels].sort();
}

export async function loadCohort(label) {
  return mget(await scanKeys(`archive:${label}:*`));
}

// 一鍵清除：現役紀錄全部搬進 archive:{label}:，並清空 Google 綁定
export async function archiveAndWipe(label) {
  const studentKeys = await scanKeys("student:*");
  let moved = 0;
  for (const k of studentKeys) {
    const rec = await redis.get(k);
    if (rec) {
      const id = k.slice("student:".length);
      await redis.set(`archive:${label}:${id}`, rec);
      moved++;
    }
    await redis.del(k);
  }
  const googleKeys = await scanKeys("google:*");
  if (googleKeys.length) await redis.del(...googleKeys);
  return moved;
}
