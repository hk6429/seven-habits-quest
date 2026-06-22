import { NextResponse } from "next/server";
import { loadStudent, saveStudent } from "@/lib/store";

// 任務四：每週充電打卡（CD6 真實週循環 + CD2 連續紀錄，白帽、不阻擋進度）
function isoWeek(d) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

export async function POST(req) {
  const { cls, seat } = await req.json();
  const record = await loadStudent(cls, parseInt(seat, 10));
  if (!record) {
    return NextResponse.json({ error: "找不到玩家，請重新登入" }, { status: 404 });
  }
  const now = new Date();
  const thisWeek = isoWeek(now);
  const prevWeek = isoWeek(new Date(now.getTime() - 7 * 86400000));
  const rc = record.recharge || { lastWeek: null, streak: 0, total: 0 };
  if (rc.lastWeek === thisWeek) {
    return NextResponse.json({ record, alreadyDone: true });
  }
  const streak = rc.lastWeek === prevWeek ? (rc.streak || 0) + 1 : 1;
  record.recharge = { lastWeek: thisWeek, streak, total: (rc.total || 0) + 1 };
  await saveStudent(record);
  return NextResponse.json({ record, alreadyDone: false });
}
