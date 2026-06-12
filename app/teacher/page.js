"use client";

import { useEffect, useMemo, useState } from "react";
import { HABITS, LEVELS_PER_HABIT, PASS_STARS } from "@/lib/config";
import { CONTENT } from "@/lib/content";

const TABS = [
  ["progress", "學生進度"],
  ["choices", "選擇歷程分析"],
  ["grades", "成績管理"],
  ["danger", "清除／換屆"],
];

function summarize(s) {
  let totalStars = 0, totalAttempts = 0, passed = 0;
  const perHabit = HABITS.map((h) => {
    let c = 0;
    for (let l = 1; l <= LEVELS_PER_HABIT; l++) {
      const r = s.levels?.[`${h.n}-${l}`];
      if (r) { totalStars += r.stars; totalAttempts += r.attempts; if (r.stars >= PASS_STARS) c++; }
    }
    passed += c;
    return c;
  });
  return { perHabit, totalStars, totalAttempts, passed };
}

export default function Teacher() {
  const [pw, setPw] = useState("");
  const [students, setStudents] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [clsFilter, setClsFilter] = useState("全部");
  const [tab, setTab] = useState("progress");

  const [habitSel, setHabitSel] = useState(1);

  const [cohorts, setCohorts] = useState(null);
  const [cohortSel, setCohortSel] = useState("__current__");
  const [cohortData, setCohortData] = useState(null);

  const [wipeLabel, setWipeLabel] = useState("");
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeMsg, setWipeMsg] = useState("");

  async function api(body) {
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pw, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "讀取失敗");
    return data;
  }

  async function load() {
    setBusy(true); setErr("");
    try {
      const data = await api({});
      setStudents(data.students);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 成績管理：載入屆列表
  useEffect(() => {
    if (tab !== "grades" || !students || cohorts) return;
    api({ action: "cohorts" }).then((d) => setCohorts(d.cohorts)).catch(() => setCohorts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, students]);

  // 成績管理：切屆載資料
  useEffect(() => {
    if (cohortSel === "__current__") { setCohortData(null); return; }
    setBusy(true);
    api({ action: "archive", label: cohortSel })
      .then((d) => setCohortData(d.students))
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortSel]);

  const classes = useMemo(() => students ? [...new Set(students.map((s) => s.cls))] : [], [students]);
  const shown = useMemo(() => students?.filter((s) => clsFilter === "全部" || s.cls === clsFilter) ?? [], [students, clsFilter]);

  // 卡關率
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

  // ---------- 選擇歷程分析 ----------
  const choiceStats = useMemo(() => {
    if (!students) return null;
    const pool = shown;
    const levels = [];
    const traps = []; // 全習慣踩雷排行
    for (let l = 1; l <= LEVELS_PER_HABIT; l++) {
      const id = `${habitSel}-${l}`;
      const lv = CONTENT[habitSel].levels[l - 1];
      const scenes = lv.scenes.map((sc, si) => {
        const counts = sc.choices.map(() => 0);
        for (const s of pool) {
          const pc = s.levels?.[id]?.pickCounts;
          if (!pc) continue;
          sc.choices.forEach((_, ci) => { counts[ci] += pc[`${si}-${ci}`] || 0; });
        }
        const total = counts.reduce((a, b) => a + b, 0);
        sc.choices.forEach((c, ci) => {
          if (c.q === 0 && total >= 3 && counts[ci] / total >= 0.3) {
            traps.push({ level: l, title: lv.title, sceneText: sc.text, choiceText: c.t, n: counts[ci], pct: counts[ci] / total });
          }
        });
        return { text: sc.text, choices: sc.choices.map((c, ci) => ({ t: c.t, q: c.q, n: counts[ci], pct: total ? counts[ci] / total : 0 })), total };
      });
      levels.push({ l, title: lv.title, scenes });
    }
    // 整體最佳選擇率
    let best = 0, all = 0;
    for (const lvl of levels) for (const sc of lvl.scenes) for (const c of sc.choices) { all += c.n; if (c.q === 2) best += c.n; }
    traps.sort((a, b) => b.pct - a.pct);
    return { levels, traps: traps.slice(0, 5), bestRate: all ? best / all : null, all };
  }, [students, shown, habitSel]);

  // ---------- 成績管理（屆 × 班） ----------
  const gradeRows = useMemo(() => {
    const pool = cohortSel === "__current__" ? students : cohortData;
    if (!pool) return null;
    const byCls = {};
    for (const s of pool) {
      (byCls[s.cls] = byCls[s.cls] || []).push(s);
    }
    return Object.keys(byCls).sort().map((cls) => {
      const arr = byCls[cls];
      let stars = 0, passed = 0, finished = 0, active = 0;
      for (const s of arr) {
        const sum = summarize(s);
        stars += sum.totalStars; passed += sum.passed;
        if (sum.passed === LEVELS_PER_HABIT * 7) finished++;
        if (sum.totalAttempts > 0) active++;
      }
      return { cls, n: arr.length, active, avgStars: stars / arr.length, avgPassed: passed / arr.length, finished };
    });
  }, [students, cohortData, cohortSel]);

  function exportCSV(pool, suffix) {
    const head = ["班級", "座號", "姓名", "性別", ...HABITS.map((h) => `習慣${h.n}通過數`), "總星數", "總嘗試次數", "最後活動"];
    const lines = [head.join(",")];
    for (const s of pool) {
      const { perHabit, totalStars, totalAttempts } = summarize(s);
      lines.push([s.cls, s.seat, s.name, s.gender === "F" ? "女" : "男", ...perHabit, totalStars, totalAttempts, (s.updatedAt || "").slice(0, 16).replace("T", " ")].join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `心之深淵成績_${suffix}.csv`;
    a.click();
  }

  async function doWipe() {
    setWipeMsg(""); setErr("");
    setBusy(true);
    try {
      const d = await api({ action: "wipe", label: wipeLabel });
      setWipeMsg(`✅ 已歸檔 ${d.moved} 筆到「${d.label}」，現役紀錄已清空，下一屆可直接使用。`);
      setWipeConfirm(""); setWipeLabel("");
      setCohorts(null);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ====================== 畫面 ======================

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
    <div className="wrap" style={{ maxWidth: 1080 }}>
      <div className="topbar">
        <span>教師後台・現役 {students.length} 位學生</span>
        <span>
          <select style={{ width: "auto", padding: "4px 8px", fontSize: 13 }} value={clsFilter} onChange={(e) => setClsFilter(e.target.value)}>
            <option>全部</option>
            {classes.map((c) => <option key={c}>{c}</option>)}
          </select>
          　<button onClick={() => load()}>重新整理</button>
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "4px 0 16px", flexWrap: "wrap" }}>
        {TABS.map(([k, t]) => (
          <button key={k} className="btn" style={{ width: "auto", padding: "8px 18px", marginTop: 0, textAlign: "center", borderColor: tab === k ? "var(--gold)" : undefined, color: tab === k ? "var(--gold)" : undefined }} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}

      {/* ---------- 學生進度 ---------- */}
      {tab === "progress" && (
        <>
          <h3 style={{ margin: "10px 0" }}>完成度矩陣 <button style={{ marginLeft: 10, fontSize: 13 }} onClick={() => exportCSV(shown, clsFilter)}>匯出 CSV</button></h3>
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
                  const { perHabit, totalStars, totalAttempts } = summarize(s);
                  return (
                    <tr key={`${s.cls}-${s.seat}`}>
                      <td>{s.cls}</td><td>{s.seat}</td><td>{s.name}</td>
                      {perHabit.map((c, i) => (
                        <td key={i} style={{ background: c === LEVELS_PER_HABIT ? "#1d3a26" : c > 0 ? "#2a2f1e" : undefined }}>{c}/{LEVELS_PER_HABIT}</td>
                      ))}
                      <td>{totalStars}</td><td>{totalAttempts}</td>
                      <td>{(s.updatedAt || "").slice(5, 16).replace("T", " ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: "18px 0 10px" }}>最卡關的 10 關（全班都過不了的情境，就是下週課堂該談的情境）</h3>
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
        </>
      )}

      {/* ---------- 選擇歷程分析 ---------- */}
      {tab === "choices" && choiceStats && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ margin: "10px 0" }}>選擇歷程分析</h3>
            <select style={{ width: "auto", padding: "4px 8px", fontSize: 13 }} value={habitSel} onChange={(e) => setHabitSel(parseInt(e.target.value, 10))}>
              {HABITS.map((h) => <option key={h.n} value={h.n}>習慣{h.n}・{h.name}</option>)}
            </select>
          </div>

          <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
            <b>自動分析</b>（{clsFilter}・累計 {choiceStats.all} 次選擇）
            {choiceStats.all === 0 ? (
              <p style={{ color: "var(--dim)", marginTop: 6 }}>這個習慣還沒有選擇紀錄。學生 2026-06-13 之後的闖關才會記錄選擇歷程。</p>
            ) : (
              <>
                <p style={{ marginTop: 6 }}>最佳選擇率（選到 ⚡+2 的比例）：<b style={{ color: "var(--gold)" }}>{Math.round(choiceStats.bestRate * 100)}%</b></p>
                {choiceStats.traps.length > 0 ? (
                  <>
                    <p style={{ marginTop: 8 }}>⚠️ 高踩雷選項（≥30% 的人選了 0 分選項）——這些就是課堂上最值得攤開來談的情境：</p>
                    <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                      {choiceStats.traps.map((t, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          第 {t.level} 關〈{t.title}〉：<b>{Math.round(t.pct * 100)}%</b>（{t.n} 人次）選了「{t.choiceText.slice(0, 40)}」
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p style={{ marginTop: 8 }}>沒有明顯的集體踩雷點（沒有任何 0 分選項被 30% 以上的人選中）。</p>
                )}
              </>
            )}
          </div>

          {choiceStats.levels.map((lvl) => {
            const has = lvl.scenes.some((sc) => sc.total > 0);
            if (!has) return null;
            return (
              <div key={lvl.l} className="card" style={{ padding: 14 }}>
                <b>第 {lvl.l} 關・{lvl.title}</b>
                {lvl.scenes.map((sc, si) => sc.total > 0 && (
                  <div key={si} style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 13.5, color: "var(--dim)", whiteSpace: "pre-wrap" }}>{sc.text.slice(0, 80)}{sc.text.length > 80 ? "⋯" : ""}</p>
                    {sc.choices.map((c, ci) => (
                      <div key={ci} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, marginTop: 3 }}>
                        <span style={{ flex: "none", width: 38, color: c.q === 2 ? "var(--gold)" : c.q === 0 ? "#ff8a8a" : "var(--dim)" }}>{c.q === 2 ? "+2" : c.q === 1 ? "+1" : "0"}</span>
                        <div style={{ flex: "none", width: 120, height: 10, background: "#1e2330", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(c.pct * 100)}%`, height: "100%", background: c.q === 2 ? "var(--gold)" : c.q === 0 ? "#c0504d" : "#6b7280" }} />
                        </div>
                        <span style={{ flex: "none", width: 70 }}>{Math.round(c.pct * 100)}%（{c.n}）</span>
                        <span style={{ color: "#c9c6bd" }}>{c.t.slice(0, 46)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* ---------- 成績管理 ---------- */}
      {tab === "grades" && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ margin: "10px 0" }}>成績管理（屆 × 班）</h3>
            <select style={{ width: "auto", padding: "4px 8px", fontSize: 13 }} value={cohortSel} onChange={(e) => setCohortSel(e.target.value)}>
              <option value="__current__">目前這一屆（現役）</option>
              {(cohorts || []).map((c) => <option key={c} value={c}>歸檔：{c}</option>)}
            </select>
            {gradeRows && <button style={{ fontSize: 13 }} onClick={() => exportCSV(cohortSel === "__current__" ? students : cohortData, cohortSel === "__current__" ? "現役" : cohortSel)}>匯出整屆 CSV</button>}
          </div>
          {busy && <p style={{ color: "var(--dim)" }}>讀取中⋯⋯</p>}
          {gradeRows && (
            <div className="scroll-x card" style={{ padding: 8 }}>
              <table className="matrix">
                <thead><tr><th>班級</th><th>登錄人數</th><th>有闖關</th><th>平均總★</th><th>平均過關數</th><th>全破 105 關</th></tr></thead>
                <tbody>
                  {gradeRows.length === 0 && <tr><td colSpan={6}>這一屆沒有資料</td></tr>}
                  {gradeRows.map((r) => (
                    <tr key={r.cls}>
                      <td>{r.cls}</td><td>{r.n}</td><td>{r.active}</td>
                      <td>{r.avgStars.toFixed(1)}</td><td>{r.avgPassed.toFixed(1)} / 105</td><td>{r.finished}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------- 清除／換屆 ---------- */}
      {tab === "danger" && (
        <div className="card" style={{ borderLeft: "3px solid #c0504d", maxWidth: 560 }}>
          <h3>一鍵清除（換屆）</h3>
          <p style={{ fontSize: 14, color: "var(--dim)", marginTop: 6 }}>
            會把現役 {students.length} 位學生的紀錄<b>整批歸檔</b>（成績管理分頁仍查得到），
            並清空所有 Google 綁定，讓下一屆學生從零開始。此動作無法復原。
          </p>
          <label>歸檔名稱（例：114學年八年級）</label>
          <input value={wipeLabel} maxLength={30} placeholder="例：114學年八年級" onChange={(e) => setWipeLabel(e.target.value)} />
          <label>確認：請輸入「清除」兩個字</label>
          <input value={wipeConfirm} onChange={(e) => setWipeConfirm(e.target.value)} />
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" style={{ background: "#c0504d", boxShadow: "none" }} disabled={busy || wipeConfirm !== "清除" || !wipeLabel.trim()} onClick={doWipe}>
              {busy ? "處理中⋯⋯" : "歸檔並清除現役紀錄"}
            </button>
          </div>
          {wipeMsg && <p style={{ color: "#7fd48a", marginTop: 10 }}>{wipeMsg}</p>}
        </div>
      )}
    </div>
  );
}
