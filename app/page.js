"use client";

import { useEffect, useState } from "react";
import { CLASSES, MAX_SEAT, HABITS, LEVELS_PER_HABIT, PASS_STARS, calcStars } from "@/lib/config";
import { getLevel } from "@/lib/content";

const SAVE_KEY = "shq-login";

export default function Game() {
  const [phase, setPhase] = useState("login"); // login | map | levels | play | result
  const [player, setPlayer] = useState(null);
  const [form, setForm] = useState({ cls: "", seat: "", name: "", gender: "" });
  const [mismatchName, setMismatchName] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [habitN, setHabitN] = useState(1);
  const [levelN, setLevelN] = useState(1);
  const [sceneIdx, setSceneIdx] = useState(-1); // -1 = intro 畫面
  const [picked, setPicked] = useState(null);
  const [earned, setEarned] = useState(0);
  const [resultStars, setResultStars] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (saved) setForm(saved);
    } catch {}
  }, []);

  const habit = HABITS[habitN - 1];
  const level = phase === "play" || phase === "result" ? getLevel(habitN, levelN) : null;
  const maxPts = level ? level.scenes.length * 2 : 0;

  // ---------- 共用 ----------
  function starsOf(h, l) {
    return player?.levels?.[`${h}-${l}`]?.stars ?? -1; // -1 = 沒玩過
  }
  function passedCount(h) {
    let c = 0;
    for (let l = 1; l <= LEVELS_PER_HABIT; l++) if (starsOf(h, l) >= PASS_STARS) c++;
    return c;
  }
  function habitUnlocked(h) {
    return h === 1 || passedCount(h - 1) === LEVELS_PER_HABIT;
  }
  function levelUnlocked(h, l) {
    return l === 1 || starsOf(h, l - 1) >= PASS_STARS;
  }

  // ---------- 登入 ----------
  async function login(confirmExisting = false) {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, confirmExisting }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "發生錯誤，再試一次"); return; }
      if (data.mismatch) { setMismatchName(data.existingName); return; }
      localStorage.setItem(SAVE_KEY, JSON.stringify(form));
      setPlayer(data.record);
      setMismatchName(null);
      setPhase("map");
    } catch {
      setErr("連線失敗，確認網路後再試一次");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setPlayer(null);
    setPhase("login");
  }

  // ---------- 闖關 ----------
  function startLevel(h, l) {
    setHabitN(h); setLevelN(l);
    setSceneIdx(-1); setPicked(null); setEarned(0);
    setPhase("play");
  }

  function pick(i) {
    if (picked !== null) return;
    setPicked(i);
    setEarned((e) => e + getLevel(habitN, levelN).scenes[sceneIdx].choices[i].q);
  }

  async function nextScene() {
    if (sceneIdx === -1) { setSceneIdx(0); return; }
    const lv = getLevel(habitN, levelN);
    if (sceneIdx + 1 < lv.scenes.length) {
      setSceneIdx(sceneIdx + 1);
      setPicked(null);
      return;
    }
    // 結算
    const finalEarned = earned;
    const stars = calcStars(finalEarned, lv.scenes.length * 2);
    setResultStars(stars);
    setPhase("result");
    try {
      const res = await fetch("/api/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cls: player.cls, seat: player.seat, levelId: `${habitN}-${levelN}`, stars }),
      });
      const data = await res.json();
      if (res.ok) setPlayer(data.record);
    } catch {
      // 成績暫存失敗也不擋遊戲；下次過關會再寫
    }
  }

  // ====================== 畫面 ======================

  if (phase === "login") {
    return (
      <div className="wrap">
        <h1 className="title-zh">心之深淵</h1>
        <p className="subtitle">選擇之劍・七個習慣闖關</p>
        <div className="card">
          <p className="scene-text" style={{ fontSize: 15, color: "var(--dim)" }}>
            你在睡夢中墜入了自己的「心之深淵」。{"\n"}七層深淵裡，住著七尊壞習慣古神——{"\n"}祂們都是你內心弱點的影子。{"\n\n"}報上名來，領取你的選擇之劍。
          </p>
        </div>

        {mismatchName ? (
          <div className="card">
            <p>這個座號已經有「<b>{mismatchName}</b>」的冒險紀錄，但你輸入的名字是「{form.name}」。</p>
            <div style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={() => setMismatchName(null)}>我填錯了，回去修改</button>
              <button className="btn ghost" onClick={() => login(true)} disabled={busy}>我就是 {mismatchName}，繼續那份進度</button>
            </div>
          </div>
        ) : (
          <div className="card">
            <label>班級</label>
            <select value={form.cls} onChange={(e) => setForm({ ...form, cls: e.target.value })}>
              <option value="">請選擇班級</option>
              {CLASSES.map((c) => <option key={c} value={c}>{c.slice(0, 1)} 年 {parseInt(c.slice(1), 10)} 班</option>)}
            </select>
            <label>座號</label>
            <select value={form.seat} onChange={(e) => setForm({ ...form, seat: e.target.value })}>
              <option value="">請選擇座號</option>
              {Array.from({ length: MAX_SEAT }, (_, i) => i + 1).map((s) => <option key={s} value={s}>{s} 號</option>)}
            </select>
            <label>姓名</label>
            <input value={form.name} maxLength={12} placeholder="請輸入真實姓名" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label>我是</label>
            <div style={{ display: "flex", gap: 10 }}>
              {[["M", "男生"], ["F", "女生"]].map(([v, t]) => (
                <button key={v} className="btn" style={{ textAlign: "center", borderColor: form.gender === v ? "var(--accent)" : undefined, background: form.gender === v ? "var(--accent)" : undefined, color: form.gender === v ? "#fff" : undefined, marginTop: 0 }} onClick={() => setForm({ ...form, gender: v })}>{t}</button>
              ))}
            </div>
            <div style={{ marginTop: 22 }}>
              <button className="btn primary" disabled={busy || !form.cls || !form.seat || !form.name.trim() || !form.gender} onClick={() => login(false)}>
                {busy ? "進入中⋯⋯" : "拔 劍 入 淵"}
              </button>
            </div>
            {err && <p className="err">{err}</p>}
          </div>
        )}
        <p style={{ textAlign: "center", fontSize: 12, color: "#555c6e", marginTop: 24 }}>竹光國中・自我領導力課程</p>
      </div>
    );
  }

  if (phase === "map") {
    const hero = player.gender === "F" ? "少女劍士" : "少年劍士";
    const totalPassed = HABITS.reduce((s, h) => s + passedCount(h.n), 0);
    return (
      <div className="wrap">
        <div className="topbar">
          <span>⚔️ {hero}・{player.name}（{player.cls} 班 {player.seat} 號）</span>
          <button onClick={logout}>離開</button>
        </div>
        <h2 style={{ textAlign: "center", letterSpacing: 4 }}>深淵地圖</h2>
        <p className="subtitle">已突破 {totalPassed} / {LEVELS_PER_HABIT * 7} 關</p>
        {HABITS.map((h) => {
          const unlocked = habitUnlocked(h.n);
          const pc = passedCount(h.n);
          return (
            <div key={h.n} className={`habit-row${unlocked ? "" : " locked"}`}
              style={{
                "--accent": h.color,
                backgroundImage: unlocked
                  ? `linear-gradient(90deg, rgba(13,15,20,.93) 38%, rgba(13,15,20,.62)), url(/layers/${h.n}.jpg)`
                  : undefined,
              }}
              onClick={() => { if (unlocked) { setHabitN(h.n); setPhase("levels"); } }}>
              <div className="habit-num">{unlocked ? h.n : "🔒"}</div>
              <div className="habit-info">
                <div className="nm">第{["一", "二", "三", "四", "五", "六", "七"][h.n - 1]}層・{h.name}</div>
                <div className="gd">{h.god}</div>
              </div>
              <div className="habit-prog">{pc === LEVELS_PER_HABIT ? "✦ 已斬" : `${pc} / ${LEVELS_PER_HABIT}`}</div>
            </div>
          );
        })}
        <p style={{ fontSize: 12.5, color: "#555c6e", textAlign: "center", marginTop: 18 }}>
          每一層 15 關全數通過（每關至少 ★★），才能下到下一層。{"\n"}已通過的關卡隨時可以重玩複習。
        </p>
      </div>
    );
  }

  if (phase === "levels") {
    const pc = passedCount(habitN);
    return (
      <div className="wrap" style={{ "--accent": habit.color }}>
        <div className="topbar">
          <button onClick={() => setPhase("map")}>← 回深淵地圖</button>
          <span>{pc} / {LEVELS_PER_HABIT}</span>
        </div>
        <div className="layer-hero"><img src={`/layers/${habitN}.jpg`} alt={habit.god} /></div>
        <h2 style={{ color: habit.color }}>{habit.god}</h2>
        <h3 style={{ margin: "2px 0 8px" }}>習慣{["一", "二", "三", "四", "五", "六", "七"][habitN - 1]}・{habit.name}</h3>
        <p style={{ color: "var(--dim)", fontSize: 14.5 }}>{habit.godIntro}</p>
        <p style={{ color: "var(--gold)", fontSize: 14, margin: "10px 0 4px" }}>「{habit.tagline}」</p>
        <div className="level-grid">
          {Array.from({ length: LEVELS_PER_HABIT }, (_, i) => i + 1).map((l) => {
            const st = starsOf(habitN, l);
            const unlocked = levelUnlocked(habitN, l);
            const lv = getLevel(habitN, l);
            return (
              <button key={l} disabled={!unlocked}
                className={`level-cell${st >= PASS_STARS ? " done" : ""}${lv.type === "boss" ? " boss" : ""}`}
                onClick={() => startLevel(habitN, l)}>
                <span>{lv.type === "boss" ? "魔" : l}</span>
                <span className="st">{st > 0 ? "★".repeat(st) : st === 0 ? "—" : unlocked ? "·" : "🔒"}</span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12.5, color: "#555c6e", marginTop: 14 }}>★★ 以上算通過。點已通過的關卡可重玩複習，成績取最佳。</p>
      </div>
    );
  }

  if (phase === "play") {
    if (sceneIdx === -1) {
      return (
        <div className="wrap" style={{ "--accent": habit.color }}>
          <div className="topbar">
            <button onClick={() => setPhase("levels")}>← 放棄這次挑戰</button>
            <span>{habit.name}・第 {levelN} 關</span>
          </div>
          {level.type === "boss" && <div className="layer-hero"><img src={`/layers/${habitN}.jpg`} alt={habit.god} /></div>}
          <div className="card">
            <h3 style={{ color: habit.color, marginBottom: 8 }}>{level.title}</h3>
            <p className="scene-text">{level.intro}</p>
          </div>
          <button className="btn primary" onClick={nextScene}>開 始</button>
        </div>
      );
    }
    const scene = level.scenes[sceneIdx];
    const choice = picked !== null ? scene.choices[picked] : null;
    return (
      <div className="wrap" style={{ "--accent": habit.color }}>
        <div className="topbar">
          <button onClick={() => setPhase("levels")}>← 放棄</button>
          <span>{level.title}　{sceneIdx + 1} / {level.scenes.length}</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${((sceneIdx) / level.scenes.length) * 100}%` }} /></div>
        <div className="sword-energy">⚡ 劍能 {earned} / {maxPts}</div>
        <div className="card">
          <p className="scene-text">{scene.text}</p>
        </div>
        {scene.choices.map((c, i) => (
          <button key={i} className="btn" disabled={picked !== null && picked !== i}
            style={picked === i ? { borderColor: habit.color } : undefined}
            onClick={() => pick(i)}>
            {c.t}
          </button>
        ))}
        {choice && (
          <>
            <div className="feedback">
              <span className="who">🗡️ 劍靈</span>
              {choice.fb}
              {choice.q === 2 && <span style={{ color: "var(--gold)" }}>　⚡+2</span>}
              {choice.q === 1 && <span style={{ color: "var(--dim)" }}>　⚡+1</span>}
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={nextScene}>
                {sceneIdx + 1 < level.scenes.length ? "繼 續" : "結 算"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === "result") {
    const passed = resultStars >= PASS_STARS;
    const hasNext = levelN < LEVELS_PER_HABIT;
    return (
      <div className="wrap" style={{ "--accent": habit.color }}>
        <div style={{ height: 40 }} />
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: habit.color }}>{level.title}</h3>
          <div className="stars">{"★".repeat(resultStars)}{"☆".repeat(3 - resultStars)}</div>
          <p style={{ fontWeight: 700, marginBottom: 12 }}>{passed ? (level.type === "boss" ? `你斬落了${habit.god}！` : "通過！") : "古神的絲線還纏著你⋯⋯再試一次"}</p>
          <p className="scene-text" style={{ textAlign: "left", fontSize: 15, color: passed ? "var(--text)" : "var(--dim)" }}>
            {passed ? level.outro : "別擔心，這裡不是考試。重新進關，注意劍靈的提示——哪些選擇讓劍充能、哪些讓絲線收緊。"}
          </p>
        </div>
        {!passed && <button className="btn primary" onClick={() => startLevel(habitN, levelN)}>再 戰 一 次</button>}
        {passed && hasNext && levelUnlocked(habitN, levelN + 1) && (
          <button className="btn primary" onClick={() => startLevel(habitN, levelN + 1)}>下 一 關</button>
        )}
        {passed && !hasNext && (
          <button className="btn primary" onClick={() => setPhase("map")}>回深淵地圖・前往下一層</button>
        )}
        <button className="btn ghost" onClick={() => setPhase("levels")}>回關卡列表</button>
        {passed && <button className="btn ghost" onClick={() => startLevel(habitN, levelN)}>重玩這關（複習）</button>}
      </div>
    );
  }

  return null;
}
