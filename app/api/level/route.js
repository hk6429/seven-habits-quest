import { NextResponse } from "next/server";
import { loadStudent, saveStudent } from "@/lib/store";
import { LEVELS_PER_HABIT } from "@/lib/config";

const LEVEL_KEY = /^[1-7]-([1-9]|1[0-5])$/;

// 把前端帶上來的進度快照清洗成只含 stars/attempts 的安全物件，
// 避免「讀到舊版存檔→蓋掉剛完成的關卡」競態造成 3 星關卡消失。
function sanitizeKnown(known) {
  const out = {};
  if (!known || typeof known !== "object") return out;
  for (const [id, v] of Object.entries(known)) {
    if (!LEVEL_KEY.test(id) || !v || typeof v !== "object") continue;
    const s = parseInt(v.stars, 10);
    const a = parseInt(v.attempts, 10);
    out[id] = {
      stars: s >= 0 && s <= 3 ? s : 0,
      attempts: a >= 0 && a < 1000 ? a : 0,
    };
  }
  return out;
}

export async function POST(req) {
  const { cls, seat, levelId, stars, picks, knownLevels } = await req.json();

  // levelId 格式: "習慣-關卡"，如 "3-12"
  const m = /^([1-7])-([0-9]{1,2})$/.exec(String(levelId || ""));
  const starNum = parseInt(stars, 10);
  if (!m || parseInt(m[2], 10) < 1 || parseInt(m[2], 10) > LEVELS_PER_HABIT) {
    return NextResponse.json({ error: "關卡編號不正確" }, { status: 400 });
  }
  if (!(starNum >= 0 && starNum <= 3)) {
    return NextResponse.json({ error: "星數不正確" }, { status: 400 });
  }

  const record = await loadStudent(cls, parseInt(seat, 10));
  if (!record) {
    return NextResponse.json({ error: "找不到玩家，請重新登入" }, { status: 404 });
  }

  // 聯集合併：以伺服器存檔為底，補回前端快照裡更完整的進度（取最大星數），
  // 確保即使 blob 讀到尚未同步的舊版，也不會弄丟已完成的關卡。
  const merged = { ...(record.levels || {}) };
  const known = sanitizeKnown(knownLevels);
  for (const [id, v] of Object.entries(known)) {
    const a = merged[id];
    if (!a) {
      merged[id] = v;
    } else {
      merged[id] = {
        ...a,
        stars: Math.max(a.stars || 0, v.stars || 0),
        attempts: Math.max(a.attempts || 0, v.attempts || 0),
      };
    }
  }

  // 選擇歷程：[{s:場景, c:選項, q:得分}, ...]，留最近一次＋累計分布
  const cleanPicks = (Array.isArray(picks) ? picks : [])
    .slice(0, 10)
    .map((p) => ({ s: parseInt(p?.s, 10), c: parseInt(p?.c, 10), q: parseInt(p?.q, 10) }))
    .filter((p) => p.s >= 0 && p.s < 10 && p.c >= 0 && p.c < 6 && [0, 1, 2].includes(p.q));

  const prev = merged[levelId] || { stars: 0, attempts: 0 };
  const pickCounts = { ...(prev.pickCounts || {}) };
  for (const p of cleanPicks) {
    const k = `${p.s}-${p.c}`;
    pickCounts[k] = (pickCounts[k] || 0) + 1;
  }
  const newAttempts = (prev.attempts || 0) + 1;
  // tries3：第一次拿到三星時是第幾次嘗試（拿到後就固定不再更動）
  let tries3 = prev.tries3;
  if (tries3 == null && (prev.stars || 0) < 3 && starNum >= 3) tries3 = newAttempts;
  merged[levelId] = {
    stars: Math.max(prev.stars || 0, starNum),
    attempts: newAttempts,
    tries3,
    ts: new Date().toISOString(),
    lastPicks: cleanPicks.length ? cleanPicks : prev.lastPicks,
    pickCounts,
  };

  record.levels = merged;
  await saveStudent(record);
  return NextResponse.json({ record });
}
