import { NextResponse } from "next/server";
import { loadStudent, saveStudent } from "@/lib/store";
import { HABITS, LEVELS_PER_HABIT } from "@/lib/config";

export async function POST(req) {
  const { cls, seat, levelId, stars } = await req.json();

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

  const prev = record.levels[levelId] || { stars: 0, attempts: 0 };
  record.levels[levelId] = {
    stars: Math.max(prev.stars, starNum),
    attempts: prev.attempts + 1,
    ts: new Date().toISOString(),
  };
  await saveStudent(record);
  return NextResponse.json({ record });
}
