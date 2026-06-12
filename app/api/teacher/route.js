import { NextResponse } from "next/server";
import { loadAllStudents, listCohorts, loadCohort, archiveAndWipe } from "@/lib/store";

const sortStudents = (arr) =>
  arr.sort((a, b) => (a.cls === b.cls ? a.seat - b.seat : String(a.cls).localeCompare(String(b.cls))));

export async function POST(req) {
  const { pw, action, label } = await req.json();
  if (!process.env.TEACHER_PASSWORD || pw !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
  }

  if (action === "cohorts") {
    return NextResponse.json({ cohorts: await listCohorts() });
  }

  if (action === "archive") {
    if (!label) return NextResponse.json({ error: "缺少屆別" }, { status: 400 });
    return NextResponse.json({ students: sortStudents(await loadCohort(label)) });
  }

  if (action === "wipe") {
    const cleanLabel = String(label || "").trim().replace(/[^\w一-鿿-]/g, "").slice(0, 30);
    if (!cleanLabel) return NextResponse.json({ error: "請輸入歸檔名稱" }, { status: 400 });
    const existing = await listCohorts();
    if (existing.includes(cleanLabel)) {
      return NextResponse.json({ error: "這個歸檔名稱已存在，換一個（避免覆蓋舊屆資料）" }, { status: 409 });
    }
    const moved = await archiveAndWipe(cleanLabel);
    return NextResponse.json({ ok: true, moved, label: cleanLabel });
  }

  return NextResponse.json({ students: sortStudents(await loadAllStudents()) });
}
