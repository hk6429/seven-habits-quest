import { NextResponse } from "next/server";
import { loadStudent, saveStudent } from "@/lib/store";
import { HABITS, LEVELS_PER_HABIT } from "@/lib/config";

export async function POST(req) {
  const { cls, seat, levelId, stars, picks } = await req.json();

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

  // 選擇歷程：[{s:場景, c:選項, q:得分}, ...]，留最近一次＋累計分布
  const cleanPicks = (Array.isArray(picks) ? picks : [])
    .slice(0, 10)
    .map((p) => ({ s: parseInt(p?.s, 10), c: parseInt(p?.c, 10), q: parseInt(p?.q, 10) }))
    .filter((p) => p.s >= 0 && p.s < 10 && p.c >= 0 && p.c < 6 && [0, 1, 2].includes(p.q));

  const prev = record.levels[levelId] || { stars: 0, attempts: 0 };
  const pickCounts = { ...(prev.pickCounts || {}) };
  for (const p of cleanPicks) {
    const k = `${p.s}-${p.c}`;
    pickCounts[k] = (pickCounts[k] || 0) + 1;
  }
  record.levels[levelId] = {
    stars: Math.max(prev.stars, starNum),
    attempts: prev.attempts + 1,
    ts: new Date().toISOString(),
    lastPicks: cleanPicks.length ? cleanPicks : prev.lastPicks,
    pickCounts,
  };
  await saveStudent(record);
  return NextResponse.json({ record });
}
