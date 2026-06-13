import { NextResponse } from "next/server";
import { loadStudent, saveStudent, loadGoogleBind, saveGoogleBind, loadStudentCode } from "@/lib/store";
import { CLASSES, MAX_SEAT } from "@/lib/config";

async function verifyCredential(credential) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;
  const info = await res.json();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (clientId && info.aud !== clientId) return null;
  return info;
}

export async function POST(req) {
  const { credential, cls, seat, name, gender, confirmExisting, code } = await req.json();
  if (!credential) {
    return NextResponse.json({ error: "缺少 Google 憑證" }, { status: 400 });
  }
  const info = await verifyCredential(credential);
  if (!info?.sub) {
    return NextResponse.json({ error: "Google 登入驗證失敗，請再試一次" }, { status: 401 });
  }

  // 已綁定過 → 直接回傳紀錄
  const bind = await loadGoogleBind(info.sub);
  if (bind) {
    const record = await loadStudent(bind.cls, bind.seat);
    if (record) return NextResponse.json({ record });
  }

  // 第一次登入、還沒送設定資料 → 請前端顯示班級座號表單
  if (!cls) {
    return NextResponse.json({ needSetup: true, profile: { name: info.name || "", email: info.email || "" } });
  }

  // 綁定班級座號（首次需通行碼）
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
  if (existing?.googleSub && existing.googleSub !== info.sub) {
    return NextResponse.json({ error: "這個座號已被其他 Google 帳號綁定，請找老師處理" }, { status: 409 });
  }
  if (existing && existing.name !== cleanName && !confirmExisting) {
    // 座號已有舊紀錄但姓名不同 → 請學生確認（沿用冒名防護）
    return NextResponse.json({ mismatch: true, existingName: existing.name });
  }

  const record = await saveStudent(
    existing
      ? { ...existing, googleSub: info.sub, email: info.email || existing.email }
      : {
          cls,
          seat: seatNum,
          name: cleanName,
          gender,
          googleSub: info.sub,
          email: info.email || "",
          createdAt: new Date().toISOString(),
          levels: {},
        }
  );
  await saveGoogleBind(info.sub, cls, seatNum);
  return NextResponse.json({ record });
}
