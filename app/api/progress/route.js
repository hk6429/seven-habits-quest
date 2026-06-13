import { NextResponse } from "next/server";
import { loadStudent, saveStudent, loadStudentCode } from "@/lib/store";
import { CLASSES, MAX_SEAT } from "@/lib/config";

export async function POST(req) {
  const { cls, seat, name, gender, confirmExisting, code } = await req.json();

  const expected = await loadStudentCode();
  if (!expected || String(code || "").trim() !== expected) {
    return NextResponse.json({ error: "通行碼不正確，請向老師確認" }, { status: 403 });
  }

  const seatNum = parseInt(seat, 10);
  if (!CLASSES.includes(cls) || !seatNum || seatNum < 1 || seatNum > MAX_SEAT) {
    return NextResponse.json({ error: "班級或座號不正確" }, { status: 400 });
  }
  const cleanName = String(name || "").trim().slice(0, 12);
  if (!cleanName) {
    return NextResponse.json({ error: "請輸入姓名" }, { status: 400 });
  }
  if (!["M", "F"].includes(gender)) {
    return NextResponse.json({ error: "請選擇性別" }, { status: 400 });
  }

  const existing = await loadStudent(cls, seatNum);

  if (existing && existing.name !== cleanName && !confirmExisting) {
    // 同座號已有不同姓名的紀錄 → 請學生確認，防誤填/冒用
    return NextResponse.json({ mismatch: true, existingName: existing.name });
  }

  if (existing) {
    return NextResponse.json({ record: existing });
  }

  const record = await saveStudent({
    cls,
    seat: seatNum,
    name: cleanName,
    gender,
    createdAt: new Date().toISOString(),
    levels: {},
  });
  return NextResponse.json({ record });
}
