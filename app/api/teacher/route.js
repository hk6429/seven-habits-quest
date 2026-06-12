import { NextResponse } from "next/server";
import { loadAllStudents } from "@/lib/store";

export async function POST(req) {
  const { pw } = await req.json();
  if (!process.env.TEACHER_PASSWORD || pw !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
  }
  const students = await loadAllStudents();
  students.sort((a, b) => (a.cls === b.cls ? a.seat - b.seat : a.cls.localeCompare(b.cls)));
  return NextResponse.json({ students });
}
