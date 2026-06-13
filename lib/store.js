import { put, head, list, del } from "@vercel/blob";

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

// ---------- 學生通行碼（每屆一組，如 20-800） ----------

const CODE_PATH = "config/student-code.json";

export async function loadStudentCode() {
  try {
    const meta = await head(CODE_PATH);
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).code || null;
  } catch {
    return null;
  }
}

export async function saveStudentCode(code) {
  await put(CODE_PATH, JSON.stringify({ code }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

const googlePath = (sub) => `google/${sub}.json`;

export async function loadGoogleBind(sub) {
  try {
    const meta = await head(googlePath(sub));
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // 尚未綁定
  }
}

export async function saveGoogleBind(sub, cls, seat) {
  await put(googlePath(sub), JSON.stringify({ cls, seat }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function loadAllRecords(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
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

export async function loadAllStudents() {
  return loadAllRecords("students/");
}

// ---------- 屆歸檔 ----------

export async function listCohorts() {
  const labels = new Set();
  let cursor;
  do {
    const page = await list({ prefix: "archive/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      const m = /^archive\/([^/]+)\//.exec(b.pathname);
      if (m) labels.add(m[1]);
    }
    cursor = page.cursor;
  } while (cursor);
  return [...labels].sort();
}

export async function loadCohort(label) {
  return loadAllRecords(`archive/${label}/`);
}

// 一鍵清除：現役紀錄全部搬進 archive/{label}/，並清空 Google 綁定
export async function archiveAndWipe(label) {
  let moved = 0;
  let cursor;
  do {
    const page = await list({ prefix: "students/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      try {
        const res = await fetch(`${b.url}?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const txt = await res.text();
          await put(`archive/${label}/${b.pathname.slice("students/".length)}`, txt, {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: "application/json",
            cacheControlMaxAge: 0,
          });
          moved++;
        }
      } catch {}
      await del(b.url);
    }
    cursor = page.cursor;
  } while (cursor);
  do {
    const page = await list({ prefix: "google/", cursor, limit: 1000 });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
    cursor = page.cursor;
  } while (cursor);
  return moved;
}
