"use client";

import { useMemo, useState } from "react";
import { HABITS, LEVELS_PER_HABIT, PASS_STARS } from "@/lib/config";
import { CONTENT } from "@/lib/content";

export default function Teacher() {
  const [pw, setPw] = useState("");
  const [students, setStudents] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [clsFilter, setClsFilter] = useState("全部");

  async function load() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pw }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "讀取失敗"); return; }
      setStudents(data.students);
    } catch {
      setErr("連線失敗");
    } finally {
      setBusy(false);
    }
  }

  const classes = useMemo(() => students ? [...new Set(students.map((s) => s.cls))] : [], [students]);
  const shown = useMemo(() => students?.filter((s) => clsFilter === "全部" || s.cls === clsFilter) ?? [], [students, clsFilter]);

  // 卡關率：有嘗試但尚未通過的人數
  const stuck = useMemo(() => {
    if (!students) return [];
    const rows = [];
    for (const h of HABITS) {
      for (let l = 1; l <= LEVELS_PER_HABIT; l++) {
        const id = `${h.n}-${l}`;
        let tried = 0, notPassed = 0, attempts = 0;
        for (const s of students) {
          const r = s.levels?.[id];
          if (r) { tried++; attempts += r.attempts; if (r.stars < PASS_STARS) notPassed++; }
        }
        if (tried >= 3 && notPassed > 0) {
          rows.push({ id, title: CONTENT[h.n].levels[l - 1].title, habit: h.name, tried, notPassed, rate: notPassed / tried, attempts });
        }
      }
    }
    return rows.sort((a, b) => b.rate - a.rate).slice(0, 10);
  }, [students]);

  function exportCSV() {
    const head = ["班級", "座號", "姓名", "性別", ...HABITS.map((h) => `習慣${h.n}通過數`), "總星數", "總嘗試次數", "最後活動"];
    const lines = [head.join(",")];
    for (const s of shown) {
      let totalStars = 0, totalAttempts = 0;
      const perHabit = HABITS.map((h) => {
        let c = 0;
        for (let l = 1; l <= LEVELS_PER_HABIT; l++) {
          const r = s.levels?.[`${h.n}-${l}`];
          if (r) { totalStars += r.stars; totalAttempts += r.attempts; if (r.stars >= PASS_STARS) c++; }
        }
        return c;
      });
      lines.push([s.cls, s.seat, s.name, s.gender === "F" ? "女" : "男", ...perHabit, totalStars, totalAttempts, (s.updatedAt || "").slice(0, 16).replace("T", " ")].join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `心之深淵成績_${clsFilter}.csv`;
    a.click();
  }

  if (!students) {
    return (
      <div className="wrap">
        <h2 style={{ marginTop: 40, textAlign: "center" }}>教師後台</h2>
        <div className="card" style={{ marginTop: 20 }}>
          <label>後台密碼</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={load} disabled={busy || !pw}>{busy ? "讀取中⋯⋯" : "進入"}</button>
          </div>
          {err && <p className="err">{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 980 }}>
      <div className="topbar">
        <span>教師後台・共 {students.length} 位學生</span>
        <span>
          <select style={{ width: "auto", padding: "4px 8px", fontSize: 13 }} value={clsFilter} onChange={(e) => setClsFilter(e.target.value)}>
            <option>全部</option>
            {classes.map((c) => <option key={c}>{c}</option>)}
          </select>
          　<button onClick={exportCSV}>匯出 CSV</button>
        </span>
      </div>

      <h3 style={{ margin: "10px 0" }}>完成度矩陣</h3>
      <div className="scroll-x card" style={{ padding: 8 }}>
        <table className="matrix">
          <thead>
            <tr>
              <th>班級</th><th>座號</th><th>姓名</th>
              {HABITS.map((h) => <th key={h.n} title={h.name}>習{h.n}</th>)}
              <th>總★</th><th>嘗試</th><th>最後活動</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              let totalStars = 0, totalAttempts = 0;
              const cells = HABITS.map((h) => {
                let c = 0;
                for (let l = 1; l <= LEVELS_PER_HABIT; l++) {
                  const r = s.levels?.[`${h.n}-${l}`];
                  if (r) { totalStars += r.stars; totalAttempts += r.attempts; if (r.stars >= PASS_STARS) c++; }
                }
                const done = c === LEVELS_PER_HABIT;
                return (
                  <td key={h.n} style={{ background: done ? "#1d3a26" : c > 0 ? "#2a2f1e" : undefined }}>
                    {c}/{LEVELS_PER_HABIT}
                  </td>
                );
              });
              return (
                <tr key={`${s.cls}-${s.seat}`}>
                  <td>{s.cls}</td><td>{s.seat}</td><td>{s.name}</td>
                  {cells}
                  <td>{totalStars}</td><td>{totalAttempts}</td>
                  <td>{(s.updatedAt || "").slice(5, 16).replace("T", " ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: "18px 0 10px" }}>最卡關的 10 關（教學素材：全班都選錯的情境，就是下週課堂該談的情境）</h3>
      <div className="scroll-x card" style={{ padding: 8 }}>
        <table className="matrix">
          <thead><tr><th>關卡</th><th>標題</th><th>習慣</th><th>嘗試人數</th><th>尚未通過</th><th>卡關率</th></tr></thead>
          <tbody>
            {stuck.length === 0 && <tr><td colSpan={6}>資料還不夠（單關至少 3 人玩過才列入）</td></tr>}
            {stuck.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.title}</td><td>{r.habit}</td>
                <td>{r.tried}</td><td>{r.notPassed}</td><td>{Math.round(r.rate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
