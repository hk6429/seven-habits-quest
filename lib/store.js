import { put, head, list } from "@vercel/blob";

const studentPath = (cls, seat) => `students/${cls}-${String(seat).padStart(2, "0")}.json`;

export async function loadStudent(cls, seat) {
  try {
    const meta = await head(studentPath(cls, seat));
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // 尚無紀錄
  }
}

export async function saveStudent(record) {
  record.updatedAt = new Date().toISOString();
  await put(studentPath(record.cls, record.seat), JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
  return record;
}

export async function loadAllStudents() {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: "students/", cursor, limit: 1000 });
    const records = await Promise.all(
      page.blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?t=${Date.now()}`, { cache: "no-store" });
          return res.ok ? await res.json() : null;
        } catch {
          return null;
        }
      })
    );
    out.push(...records.filter(Boolean));
    cursor = page.cursor;
  } while (cursor);
  return out;
}
