"use client";

import { useEffect, useRef, useState } from "react";
import { CLASSES, MAX_SEAT, HABITS, LEVELS_PER_HABIT, PASS_STARS, HABIT_STAR_GATE, TRAP_FAIL_LIMIT, calcStars } from "@/lib/config";
import { getLevel } from "@/lib/content";
import { sceneFor } from "@/lib/scenes";
import { GOD_LINES, SWORD_RARE } from "@/lib/godlines";

const SAVE_KEY = "shq-login";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

function Stage({ img, fallback, dark = false }) {
  // CSS 多層背景：第一層圖載入失敗時透出第二層（每關圖未生成前退回幕場景）
  const bg = fallback ? `url(${img}), url(${fallback})` : `url(${img})`;
  return <div className={`stage-bg${dark ? " dark" : ""}`} style={{ backgroundImage: bg }} />;
}

// 完成證書：純 canvas 繪製（金色深淵風，含班級／座號／姓名，可下載）
function drawCertificate(canvas, player) {
  const W = 1600, H = 1131;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const SERIF = '"Noto Serif TC","Songti TC","STSong",serif';
  const GOLD = "#d8b24a", GOLD2 = "#f0d896", INK = "#e9e4d6";

  // 背景
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0c12"); bg.addColorStop(0.5, "#14121c"); bg.addColorStop(1, "#0a0b10");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 中央暈光
  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, W * 0.6);
  glow.addColorStop(0, "rgba(216,178,74,.10)"); glow.addColorStop(1, "rgba(216,178,74,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // 金框（雙線＋四角）
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(54, 54, W - 108, H - 108);
  ctx.strokeStyle = "rgba(216,178,74,.5)"; ctx.lineWidth = 1.5; ctx.strokeRect(72, 72, W - 144, H - 144);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  const corner = (x, y, dx, dy) => { ctx.beginPath(); ctx.moveTo(x, y + dy * 46); ctx.lineTo(x, y); ctx.lineTo(x + dx * 46, y); ctx.stroke(); };
  corner(54, 54, 1, 1); corner(W - 54, 54, -1, 1); corner(54, H - 54, 1, -1); corner(W - 54, H - 54, -1, -1);

  ctx.textAlign = "center";
  // 上標
  ctx.fillStyle = GOLD; ctx.font = `28px ${SERIF}`;
  ctx.fillText("C E R T I F I C A T E   O F   C O M P L E T I O N", W / 2, 168);
  // 主標
  ctx.fillStyle = GOLD2; ctx.font = `bold 84px ${SERIF}`;
  ctx.fillText("七個習慣 闖關完成證書", W / 2, 286);
  ctx.fillStyle = INK; ctx.font = `34px ${SERIF}`;
  ctx.fillText("心之深淵 ・ 選擇之劍", W / 2, 348);
  // 分隔
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - 180, 388); ctx.lineTo(W / 2 + 180, 388); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.font = `26px ${SERIF}`; ctx.fillText("✦", W / 2, 396);

  // 內文
  ctx.fillStyle = INK; ctx.font = `36px ${SERIF}`;
  ctx.fillText("茲 證 明", W / 2, 470);
  // 班級座號姓名
  const who = player.guest
    ? `試玩者・${player.name || "訪客"}`
    : `${player.cls} 班　${player.seat} 號　${player.name}`;
  ctx.fillStyle = GOLD2; ctx.font = `bold 62px ${SERIF}`;
  ctx.fillText(who, W / 2, 566);
  // 底線
  ctx.strokeStyle = "rgba(216,178,74,.55)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - 460, 596); ctx.lineTo(W / 2 + 460, 596); ctx.stroke();

  ctx.fillStyle = INK; ctx.font = `33px ${SERIF}`;
  ctx.fillText("已勇闖七層深淵、通過全部一百零五道試煉，", W / 2, 670);
  ctx.fillText("斬破七尊壞習慣古神，習得「七個習慣」之道。", W / 2, 722);

  // 七習慣橫排
  ctx.fillStyle = GOLD; ctx.font = `30px ${SERIF}`;
  const names = HABITS.map((h) => h.name);
  ctx.fillText(names.join(" ・ "), W / 2, 800);

  // 日期
  const d = new Date();
  const dstr = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  ctx.fillStyle = INK; ctx.font = `28px ${SERIF}`;
  ctx.fillText(dstr, W / 2, 872);

  // 印章
  ctx.strokeStyle = GOLD; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(W / 2, 952, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = GOLD2; ctx.font = `bold 36px ${SERIF}`; ctx.fillText("斬", W / 2, 965);

  // 落款
  ctx.fillStyle = GOLD; ctx.font = `26px ${SERIF}`;
  ctx.fillText("竹光國中 ・ 自我領導力課程", W / 2, 1034);
}

// 依種子做穩定洗牌：回傳長度 n 的索引排列。
// 同一組 (n, seed) 永遠得到同一順序 → 同場景重繪不跳動；換場景／重玩換 seed 才變。
function shuffledOrder(n, seed) {
  const idx = Array.from({ length: n }, (_, k) => k);
  let a = (seed >>> 0) || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export default function GameApp({ allowStudent = true }) {
  const [phase, setPhase] = useState("login"); // login | map | levels | play | result
  const [entered, setEntered] = useState(false); // 首頁敘事 → 報名
  const [introDone, setIntroDone] = useState(false); // 開場影片
  const [soundOn, setSoundOn] = useState(false);
  const videoRef = useRef(null);
  const certRef = useRef(null);

  const [googleCred, setGoogleCred] = useState(null); // Google ID token（首次綁定用）
  const [setupNeeded, setSetupNeeded] = useState(false); // Google 登入後的班級座號設定
  const [guestPick, setGuestPick] = useState(false); // 訪客選主角中
  const [studentMode, setStudentMode] = useState(false); // 學生入口

  // 影片 4 秒內沒播起來（網路慢／載入失敗）就直接進首頁，不卡學生
  useEffect(() => {
    if (introDone) return;
    const t = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.currentTime < 0.2) setIntroDone(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [introDone]);
  const [player, setPlayer] = useState(null);
  const [form, setForm] = useState({ cls: "", seat: "", name: "", gender: "" });
  const [mismatchName, setMismatchName] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [board, setBoard] = useState(null); // 班級榮耀榜資料
  const [rechargeMsg, setRechargeMsg] = useState("");
  const [fountains, setFountains] = useState({ body: false, mind: false, heart: false, friend: false });

  const [habitN, setHabitN] = useState(1);
  const [levelN, setLevelN] = useState(1);
  const [sceneIdx, setSceneIdx] = useState(-1); // -1 = intro 畫面
  const [picked, setPicked] = useState(null);
  const [earned, setEarned] = useState(0);
  const [picksRun, setPicksRun] = useState([]); // 本次闖關的選擇歷程
  const [resultStars, setResultStars] = useState(0);
  const [runSeed, setRunSeed] = useState(0); // 每次進關的隨機種子（用來洗選項順序）
  const [trapHits, setTrapHits] = useState(0); // 本次闖關點到陷阱選項(q=0)的次數
  const [runFailed, setRunFailed] = useState(false); // 陷阱踩滿 → 當場判失敗

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (saved) setForm((f) => ({ ...f, ...saved }));
    } catch {}
  }, []);

  // 完成證書：進入 cert 畫面時繪製（等字型載入完再畫，避免中文變預設字型）
  useEffect(() => {
    if (phase !== "cert" || !player) return;
    let cancelled = false;
    const paint = () => { if (!cancelled && certRef.current) drawCertificate(certRef.current, player); };
    if (document.fonts?.ready) document.fonts.ready.then(paint); else paint();
    paint();
    return () => { cancelled = true; };
  }, [phase, player]);

  function downloadCert() {
    const c = certRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    const tag = player.guest ? "試玩" : `${player.cls}-${player.seat}-${player.name}`;
    a.download = `七習慣完成證書_${tag}.png`;
    a.click();
  }

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
  function habitStars(h) {
    let t = 0;
    for (let l = 1; l <= LEVELS_PER_HABIT; l++) { const s = starsOf(h, l); if (s > 0) t += s; }
    return t;
  }
  // 斬掉古神 = 15 關全過 + 該層星數湊滿 43★（防亂按／低空飛過）
  function habitCleared(h) {
    return passedCount(h) === LEVELS_PER_HABIT && habitStars(h) >= HABIT_STAR_GATE;
  }
  function habitUnlocked(h) {
    return h === 1 || habitCleared(h - 1);
  }
  function levelUnlocked(h, l) {
    return l === 1 || starsOf(h, l - 1) >= PASS_STARS;
  }

  // ---------- Google 登入 ----------
  async function onGoogleCredential(resp) {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: resp.credential }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Google 登入失敗，再試一次"); return; }
      if (data.needSetup) {
        setGoogleCred(resp.credential);
        setForm((f) => ({ ...f, name: (data.profile?.name || "").slice(0, 12) }));
        setSetupNeeded(true);
        return;
      }
      setPlayer(data.record);
      setPhase("map");
    } catch {
      setErr("連線失敗，確認網路後再試一次");
    } finally {
      setBusy(false);
    }
  }

  async function bindGoogle(confirmExisting = false) {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: googleCred, ...form, confirmExisting }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "綁定失敗，再試一次"); return; }
      if (data.mismatch) { setMismatchName(data.existingName); return; }
      setMismatchName(null);
      setPlayer(data.record);
      setPhase("map");
    } catch {
      setErr("連線失敗，確認網路後再試一次");
    } finally {
      setBusy(false);
    }
  }

  // 載入 Google Sign-In 按鈕
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || phase !== "login" || !entered || !studentMode || setupNeeded) return;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const el = document.getElementById("gsi-btn");
      if (!el || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential });
      window.google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", text: "signin_with", locale: "zh_TW", width: 280 });
    };
    if (window.google?.accounts?.id) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, entered, studentMode, setupNeeded]);

  // ---------- 訪客 ----------
  function startGuest(g) {
    setPlayer({ guest: true, cls: "試玩", seat: "—", name: "訪客", gender: g, levels: {} });
    setGuestPick(false);
    setPhase("map");
  }

  // ---------- 登入（無 Google 設定時的備援） ----------
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
    setEntered(false);
    setSetupNeeded(false);
    setGoogleCred(null);
    setGuestPick(false);
    setStudentMode(false);
    setMismatchName(null);
    setBoard(null);
    setPhase("login");
  }

  // ---------- 班級榮耀榜（任務二） ----------
  async function loadBoard() {
    setBoard(null);
    try {
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cls: player.cls }),
      });
      const d = await res.json();
      if (res.ok) setBoard(d);
    } catch {}
  }

  // ---------- 每週充電（任務四） ----------
  async function doRecharge() {
    setBusy(true);
    try {
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cls: player.cls, seat: player.seat }),
      });
      const d = await res.json();
      if (res.ok) {
        setPlayer((p) => ({ ...p, recharge: d.record.recharge }));
        setRechargeMsg(d.alreadyDone ? "本週已經充過電了 ✓　下週再來" : "⚡ 充電完成！四座泉都滿了。");
      } else {
        setRechargeMsg(d.error || "充電失敗，再試一次");
      }
    } catch {
      setRechargeMsg("連線失敗，再試一次");
    } finally {
      setBusy(false);
    }
  }

  // ---------- 闖關 ----------
  function startLevel(h, l) {
    setHabitN(h); setLevelN(l);
    setSceneIdx(-1); setPicked(null); setEarned(0); setPicksRun([]);
    setTrapHits(0); setRunFailed(false);
    setRunSeed(Math.floor(Math.random() * 2147483647) + 1); // 每次進關重新洗選項
    setPhase("play");
  }

  function pick(i) {
    if (picked !== null) return;
    setPicked(i);
    const q = getLevel(habitN, levelN).scenes[sceneIdx].choices[i].q;
    setEarned((e) => e + q);
    setPicksRun((p) => [...p, { s: sceneIdx, c: i, q }]);
    if (q === 0) {
      // 點到陷阱選項：累計，踩滿就當場判失敗（每場景只能選一次，trapHits 即為當前值）
      const next = trapHits + 1;
      setTrapHits(next);
      if (next >= TRAP_FAIL_LIMIT) setRunFailed(true);
    }
  }

  async function nextScene() {
    if (sceneIdx === -1) { setSceneIdx(0); return; }
    const lv = getLevel(habitN, levelN);
    // 還沒結束、也沒踩滿陷阱 → 進下一個場景
    if (!runFailed && sceneIdx + 1 < lv.scenes.length) {
      setSceneIdx(sceneIdx + 1);
      setPicked(null);
      return;
    }
    // 結算：踩滿陷阱直接 0★ 失敗，否則照得分算星
    const finalEarned = earned;
    const stars = runFailed ? 0 : calcStars(finalEarned, lv.scenes.length * 2);
    setResultStars(stars);
    setPhase("result");
    const key = `${habitN}-${levelN}`;
    if (player?.guest) {
      // 試玩模式：進度只留在這次瀏覽，不上傳
      const prev = player.levels[key] || { stars: 0, attempts: 0 };
      setPlayer({ ...player, levels: { ...player.levels, [key]: { stars: Math.max(prev.stars, stars), attempts: prev.attempts + 1 } } });
      return;
    }
    try {
      const res = await fetch("/api/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cls: player.cls, seat: player.seat, levelId: key, stars, picks: picksRun, knownLevels: player.levels || {} }),
      });
      const data = await res.json();
      if (res.ok) {
        // 防呆：把伺服器回傳與本機進度再聯集一次（取最大星數），
        // 即使伺服器讀到舊版也不會讓畫面上已完成的關卡消失
        setPlayer((cur) => {
          const base = { ...(cur?.levels || {}) };
          const next = { ...(data.record?.levels || {}) };
          for (const [id, v] of Object.entries(base)) {
            const b = next[id];
            next[id] = b ? { ...b, stars: Math.max(b.stars || 0, v.stars || 0) } : v;
          }
          return { ...data.record, levels: next };
        });
      }
    } catch {
      // 成績暫存失敗也不擋遊戲；下次過關會再寫
    }
  }

  // ====================== 畫面 ======================

  if (phase === "login") {
    if (!introDone) {
      return (
        <div className="intro-video-wrap">
          <video
            ref={videoRef}
            className="intro-video"
            src="/intro.mp4"
            autoPlay
            muted
            playsInline
            onEnded={() => setIntroDone(true)}
            onError={() => setIntroDone(true)}
          />
          <div className="intro-actions">
            <button className="intro-btn" onClick={() => {
              const v = videoRef.current;
              if (v) { v.muted = soundOn; setSoundOn(!soundOn); }
            }}>{soundOn ? "🔇 關聲音" : "🔊 開聲音"}</button>
            <button className="intro-btn" onClick={() => setIntroDone(true)}>跳過 ▸</button>
          </div>
        </div>
      );
    }
    if (!entered) {
      return (
        <>
          <Stage img="/layers/0.jpg" />
          <div className="wrap center" style={{ cursor: "pointer" }} onClick={() => setEntered(true)}>
            <p className="title-en">An Abyss of the Heart</p>
            <h1 className="title-zh">心之深淵</h1>
            <div className="title-rule" />
            <p className="subtitle">選擇之劍・七個習慣闖關</p>
            <p className="narration" style={{ marginTop: 42 }}>
              你在睡夢中，墜入了自己的「心之深淵」。{"\n"}七層深淵裡，住著七尊壞習慣古神——{"\n"}祂們，都是你內心弱點的影子。
            </p>
            <div style={{ marginTop: 48 }}>
              <button className="btn primary" onClick={(e) => { e.stopPropagation(); setEntered(true); }}>拔 劍 入 淵</button>
            </div>
            <p style={{ textAlign: "center", fontSize: 12, color: "#6b6878", letterSpacing: 3, marginTop: 40, textShadow: "0 1px 6px #000" }}>竹光國中・自我領導力課程</p>
          </div>
        </>
      );
    }
    const setupForm = (
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
            <button key={v} className="btn" style={{ textAlign: "center", borderColor: form.gender === v ? "var(--gold)" : undefined, background: form.gender === v ? "rgba(216,178,74,.25)" : undefined, marginTop: 0 }} onClick={() => setForm({ ...form, gender: v })}>{t}</button>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <button className="btn primary" disabled={busy || !form.cls || !form.seat || !String(form.name || "").trim() || !form.gender} onClick={() => (setupNeeded ? bindGoogle(false) : login(false))}>
            {busy ? "進 入 中" : "領 取 長 劍"}
          </button>
        </div>
        {err && <p className="err">{err}</p>}
      </div>
    );

    return (
      <>
        <Stage img="/layers/0.jpg" dark />
        <div className="wrap center">
          {mismatchName ? (
            <>
              <p className="narration" style={{ marginBottom: 26 }}>深淵認得這個座位⋯⋯</p>
              <div className="card">
                <p className="scene-text">這個座號已經有「<b>{mismatchName}</b>」的冒險紀錄，但你輸入的名字是「{form.name}」。</p>
                <div style={{ marginTop: 16 }}>
                  <button className="btn primary" onClick={() => setMismatchName(null)}>我填錯了，回去修改</button>
                  <button className="btn ghost" onClick={() => (setupNeeded ? bindGoogle(true) : login(true))} disabled={busy}>我就是 {mismatchName}，繼續那份進度</button>
                </div>
              </div>
            </>
          ) : setupNeeded ? (
            <>
              <p className="narration" style={{ marginBottom: 26 }}>劍認得你了。{"\n"}最後一步——告訴深淵，你是哪個教室來的。</p>
              {setupForm}
            </>
          ) : guestPick ? (
            <>
              <p className="narration" style={{ marginBottom: 26 }}>試玩模式——選擇你的主角。{"\n"}（進度不會保存）</p>
              <div className="card">
                <div style={{ display: "flex", gap: 10 }}>
                  {[["M", "男生"], ["F", "女生"]].map(([v, t]) => (
                    <button key={v} className="btn" style={{ textAlign: "center", marginTop: 0 }} onClick={() => startGuest(v)}>{t}</button>
                  ))}
                </div>
                <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setGuestPick(false)}>← 返回</button>
              </div>
            </>
          ) : studentMode ? (
            <>
              <p className="narration" style={{ marginBottom: 26 }}>深淵的入口浮現了一行字——{"\n"}「報上名來，領取你的選擇之劍。」</p>
              {GOOGLE_CLIENT_ID ? (
                <div className="card" style={{ textAlign: "center" }}>
                  <label style={{ marginTop: 0 }}>用 Google 帳號登入（紀錄會保存）</label>
                  <div id="gsi-btn" style={{ display: "flex", justifyContent: "center", minHeight: 44, marginTop: 6 }} />
                  {err && <p className="err">{err}</p>}
                </div>
              ) : (
                setupForm
              )}
            </>
          ) : allowStudent ? (
            <>
              <p className="narration" style={{ marginBottom: 30 }}>深淵之前，有兩條路——</p>
              <button className="btn primary" style={{ minWidth: 280 }} onClick={() => setStudentMode(true)}>⚔️ 學 生 登 入</button>
              <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--dim)", margin: "6px 0 14px", textShadow: "0 1px 6px #000" }}>闖關紀錄會保存，老師看得到你的進度</p>
              <button className="btn ghost" style={{ width: "auto", minWidth: 280, margin: "0 auto" }} onClick={() => setGuestPick(true)}>👤 訪 客 試 玩</button>
              <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--dim)", marginTop: 6, textShadow: "0 1px 6px #000" }}>不留任何紀錄，純體驗</p>
            </>
          ) : (
            <>
              <p className="narration" style={{ marginBottom: 30 }}>歡迎試玩——{"\n"}選擇你的主角，進入深淵。{"\n"}（訪客模式，進度不會保存）</p>
              <button className="btn primary" style={{ minWidth: 280 }} onClick={() => setGuestPick(true)}>👤 進 入 試 玩</button>
            </>
          )}
          <button className="btn ghost" style={{ width: "auto", minWidth: 160, margin: "16px auto 0" }} onClick={() => { if (studentMode || guestPick || setupNeeded) { setStudentMode(false); setGuestPick(false); setSetupNeeded(false); setMismatchName(null); } else { setEntered(false); } }}>← 返 回</button>
        </div>
      </>
    );
  }

  if (phase === "map") {
    const hero = player.gender === "F" ? "少女劍士" : "少年劍士";
    const totalPassed = HABITS.reduce((s, h) => s + passedCount(h.n), 0);
    const allCleared = HABITS.every((h) => habitCleared(h.n));
    return (
      <>
        <Stage img="/layers/0.jpg" dark />
        <div className="wrap">
          <div className="topbar">
            <span>{player.guest ? "⚔️ 試玩模式・進度不會保存" : `⚔️ ${hero}・${player.name}（${player.cls} 班 ${player.seat} 號）`}</span>
            <button onClick={logout}>離開</button>
          </div>
          <p className="title-en">The Seven Layers</p>
          <h2 style={{ textAlign: "center", letterSpacing: 8, textIndent: 8, fontSize: 26, textShadow: "0 2px 14px #000" }}>深淵地圖</h2>
          <p className="subtitle" style={{ marginTop: 4, marginBottom: 14 }}>已突破 {totalPassed} / {LEVELS_PER_HABIT * 7} 關</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
            <button className="btn ghost" style={{ width: "auto", minWidth: 0, margin: 0, fontSize: 13, padding: "8px 14px" }} onClick={() => setPhase("sword")}>🗡️ 我的劍</button>
            {!player.guest && (
              <>
                <button className="btn ghost" style={{ width: "auto", minWidth: 0, margin: 0, fontSize: 13, padding: "8px 14px" }} onClick={() => { setPhase("board"); loadBoard(); }}>🏰 我們班</button>
                <button className="btn ghost" style={{ width: "auto", minWidth: 0, margin: 0, fontSize: 13, padding: "8px 14px" }} onClick={() => { setRechargeMsg(""); setFountains({ body: false, mind: false, heart: false, friend: false }); setPhase("recharge"); }}>⚡ 本週充電{player.recharge?.streak ? `・連 ${player.recharge.streak} 週` : ""}</button>
              </>
            )}
          </div>
          {allCleared && (
            <div className="card" style={{ borderColor: "var(--gold)", textAlign: "center", marginBottom: 22 }}>
              <p style={{ color: "var(--gold)", fontSize: 19, letterSpacing: 2, margin: 0 }}>🏆 七層深淵全數斬破！</p>
              <p style={{ color: "#cfc9bd", fontSize: 13.5, margin: "8px 0 14px" }}>你已通過全部 105 道試煉，習得七個習慣。</p>
              <button className="btn primary" style={{ width: "auto", minWidth: 240, margin: "0 auto" }} onClick={() => setPhase("cert")}>領 取 完 成 證 書</button>
            </div>
          )}
          {HABITS.map((h) => {
            const unlocked = habitUnlocked(h.n);
            const pc = passedCount(h.n);
            const allPassed = pc === LEVELS_PER_HABIT;
            const hs = habitStars(h.n);
            return (
              <div key={h.n} className={`habit-row${unlocked ? "" : " locked"}`}
                style={{
                  "--accent": h.color,
                  backgroundImage: unlocked
                    ? `linear-gradient(90deg, rgba(10,11,16,.9) 36%, rgba(10,11,16,.5)), url(/layers/${h.n}.jpg)`
                    : undefined,
                }}
                onClick={() => { if (unlocked) { setHabitN(h.n); setPhase("levels"); } }}>
                <div className="habit-num">{unlocked ? h.n : "🔒"}</div>
                <div className="habit-info">
                  <div className="nm">第{["一", "二", "三", "四", "五", "六", "七"][h.n - 1]}層・{h.name}</div>
                  <div className="gd">{h.god}</div>
                </div>
                <div className="habit-prog">{habitCleared(h.n) ? "✦ 已斬" : allPassed ? `${hs} / ${HABIT_STAR_GATE}★` : `${pc} / ${LEVELS_PER_HABIT}`}</div>
              </div>
            );
          })}
          <p style={{ fontSize: 12.5, color: "#8a8694", textAlign: "center", marginTop: 18, textShadow: "0 1px 6px #000", whiteSpace: "pre-wrap" }}>
            每一層 15 關全數通過、且累積滿 {HABIT_STAR_GATE}★（滿 45★），才能斬古神、下到下一層。{"\n"}星數不夠就重玩已過的關卡把 ★★ 磨成 ★★★——成績取最佳。
          </p>
        </div>
      </>
    );
  }

  if (phase === "cert") {
    return (
      <>
        <Stage img="/layers/0.jpg" dark />
        <div className="wrap center" style={{ paddingTop: 30 }}>
          <p className="title-en">Certificate of Completion</p>
          <h2 style={{ textAlign: "center", letterSpacing: 6, fontSize: 24, margin: "6px 0 18px", textShadow: "0 2px 14px #000" }}>七個習慣 闖關完成證書</h2>
          <canvas ref={certRef} style={{ width: "100%", maxWidth: 760, height: "auto", borderRadius: 10, boxShadow: "0 12px 50px rgba(0,0,0,.6)", border: "1px solid rgba(216,178,74,.35)" }} />
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 22 }}>
            <button className="btn primary" style={{ width: "auto", minWidth: 200, margin: 0 }} onClick={downloadCert}>⬇ 下 載 證 書</button>
            <button className="btn ghost" style={{ width: "auto", minWidth: 160, margin: 0 }} onClick={() => setPhase("map")}>← 回深淵地圖</button>
          </div>
          {player.guest && (
            <p style={{ fontSize: 12.5, color: "#8a8694", textAlign: "center", marginTop: 16, textShadow: "0 1px 6px #000" }}>
              試玩模式的證書不含班級座號；登入後完成才會印上你的資料。
            </p>
          )}
        </div>
      </>
    );
  }

  if (phase === "sword") {
    const totalPassed = HABITS.reduce((s, h) => s + passedCount(h.n), 0);
    const totalStars = HABITS.reduce((s, h) => {
      let t = 0;
      for (let l = 1; l <= LEVELS_PER_HABIT; l++) { const st = starsOf(h.n, l); if (st > 0) t += st; }
      return s + t;
    }, 0);
    return (
      <>
        <Stage img="/layers/0.jpg" dark />
        <div className="wrap center" style={{ paddingTop: 24 }}>
          <p className="title-en">Your Sword of Choice</p>
          <h2 style={{ textAlign: "center", letterSpacing: 6, fontSize: 23, margin: "6px 0 4px", textShadow: "0 2px 14px #000" }}>選擇之劍・成長軌跡</h2>
          <p className="subtitle" style={{ marginBottom: 18 }}>已突破 {totalPassed} / 105 關　・　累計 {totalStars} ★</p>
          <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
            {HABITS.map((h) => {
              const pc = passedCount(h.n);
              const hs = habitStars(h.n);
              const done = habitCleared(h.n);
              const allPassed = pc === LEVELS_PER_HABIT;
              return (
                <div key={h.n} style={{ margin: "9px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: done ? h.color : "var(--dim)", marginBottom: 4, textShadow: "0 1px 6px #000" }}>
                    <span>{done ? "✦ " : ""}習慣{["一", "二", "三", "四", "五", "六", "七"][h.n - 1]}・{h.name}</span>
                    <span>{done ? "已斬古神" : allPassed ? `${hs}/${HABIT_STAR_GATE}★` : `${pc}/15`}</span>
                  </div>
                  <div style={{ height: 14, borderRadius: 7, background: "rgba(255,255,255,.06)", overflow: "hidden", border: done ? `1px solid ${h.color}` : "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ height: "100%", width: `${(pc / LEVELS_PER_HABIT) * 100}%`, background: h.color, opacity: done ? 1 : 0.7, transition: "width .4s" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12.5, color: "#8a8694", marginTop: 18, textShadow: "0 1px 6px #000" }}>每斬一尊古神，劍身就點亮一道光。{"\n"}七道全亮，這把劍就完全屬於你。</p>
          <button className="btn ghost" style={{ width: "auto", minWidth: 160, margin: "18px auto 0" }} onClick={() => setPhase("map")}>← 回深淵地圖</button>
        </div>
      </>
    );
  }

  if (phase === "board") {
    return (
      <>
        <Stage img="/layers/0.jpg" dark />
        <div className="wrap center" style={{ paddingTop: 24 }}>
          <p className="title-en">Our Class Abyss</p>
          <h2 style={{ textAlign: "center", letterSpacing: 5, fontSize: 23, margin: "6px 0 4px", textShadow: "0 2px 14px #000" }}>我們班的深淵　{player.cls} 班</h2>
          {!board ? (
            <p className="narration" style={{ marginTop: 20 }}>召集全班中⋯⋯</p>
          ) : (
            <>
              <p className="subtitle" style={{ marginBottom: 16 }}>{board.students} 位同學　・　合力突破 {board.totalPassed} 關　・　斬破 {board.godsDefeated} / 7 尊古神</p>
              <div style={{ maxWidth: 460, margin: "0 auto", width: "100%" }}>
                {board.gods.map((g) => (
                  <div key={g.n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", margin: "6px 0", borderRadius: 8, background: "rgba(10,11,16,.55)", borderLeft: `3px solid ${g.color}` }}>
                    <span style={{ fontSize: 14 }}>第{["一", "二", "三", "四", "五", "六", "七"][g.n - 1]}層・{g.name}</span>
                    <span style={{ fontSize: 13, color: g.defeatedBy > 0 ? g.color : "var(--dim)" }}>{g.defeatedBy > 0 ? `${g.defeatedBy} 人已斬` : "尚無人斬破"}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: "#8a8694", marginTop: 16, textShadow: "0 1px 6px #000" }}>一個人走得快，一群人走得遠。{"\n"}你斬下的每一尊古神，都讓全班更靠近光。</p>
            </>
          )}
          <button className="btn ghost" style={{ width: "auto", minWidth: 160, margin: "18px auto 0" }} onClick={() => setPhase("map")}>← 回深淵地圖</button>
        </div>
      </>
    );
  }

  if (phase === "recharge") {
    const FO = [
      ["body", "🪨 身體", "運動、睡飽、好好吃飯"],
      ["mind", "📖 大腦", "讀書、學新東西"],
      ["heart", "🧘 心情", "靜下來、寫日記、感恩"],
      ["friend", "🤝 朋友", "陪家人、幫助別人"],
    ];
    const allChecked = FO.every(([k]) => fountains[k]);
    const rc = player.recharge;
    return (
      <>
        <Stage img="/layers/7.jpg" dark />
        <div className="wrap center" style={{ paddingTop: 24 }}>
          <p className="title-en">Weekly Recharge</p>
          <h2 style={{ textAlign: "center", letterSpacing: 5, fontSize: 23, margin: "6px 0 4px", textShadow: "0 2px 14px #000" }}>本週充電・四座泉</h2>
          <p className="subtitle" style={{ marginBottom: 6 }}>{rc?.streak ? `連續充電 ${rc.streak} 週　・　累計 ${rc.total} 次` : "還沒開始充電——這是你的第一次"}</p>
          <p className="narration" style={{ fontSize: 14.5, marginBottom: 16 }}>不斷更新，是每週的事。{"\n"}這一週，你照顧了哪幾座泉？{"\n"}四座都點亮，才算完整充電。</p>
          <div className="card">
            {FO.map(([k, label, desc]) => (
              <button key={k} className="btn" style={{ textAlign: "left", marginTop: 8, borderColor: fountains[k] ? "var(--gold)" : undefined, background: fountains[k] ? "rgba(216,178,74,.2)" : "rgba(10,11,16,.5)" }} onClick={() => setFountains((f) => ({ ...f, [k]: !f[k] }))}>
                {fountains[k] ? "✓ " : ""}{label}　<span style={{ fontSize: 12, color: "var(--dim)" }}>{desc}</span>
              </button>
            ))}
            <button className="btn primary" style={{ marginTop: 16 }} disabled={busy || !allChecked} onClick={doRecharge}>{allChecked ? "完 成 本 週 充 電" : "四座泉都點亮才能充電"}</button>
            {rechargeMsg && <p style={{ color: "#7fd48a", marginTop: 10, textAlign: "center" }}>{rechargeMsg}</p>}
          </div>
          <button className="btn ghost" style={{ width: "auto", minWidth: 160, margin: "18px auto 0" }} onClick={() => setPhase("map")}>← 回深淵地圖</button>
        </div>
      </>
    );
  }

  if (phase === "levels") {
    const pc = passedCount(habitN);
    const hs = habitStars(habitN);
    const cleared = habitCleared(habitN);
    return (
      <>
        <Stage img={`/layers/${habitN}.jpg`} />
        <div className="wrap" style={{ "--accent": habit.color }}>
          <div className="topbar">
            <button onClick={() => setPhase("map")}>← 回深淵地圖</button>
            <span>{pc} / {LEVELS_PER_HABIT}</span>
          </div>
          <div style={{ marginTop: "26vh" }} />
          <h2 style={{ color: habit.color, fontSize: 30, letterSpacing: 6, textShadow: "0 2px 16px #000" }}>{habit.god}</h2>
          <h3 style={{ margin: "2px 0 8px", textShadow: "0 2px 12px #000" }}>習慣{["一", "二", "三", "四", "五", "六", "七"][habitN - 1]}・{habit.name}</h3>
          <p className="scene-text" style={{ color: "var(--dim)", fontSize: 14.5 }}>{habit.godIntro}</p>
          <p style={{ color: "var(--gold)", fontSize: 14.5, margin: "10px 0 4px", textShadow: "0 1px 8px #000" }}>「{habit.tagline}」</p>
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
          <p style={{ fontSize: 12.5, color: "var(--gold)", marginTop: 14, letterSpacing: 1, textShadow: "0 1px 6px #000" }}>1 序幕｜2–5 校園｜6–9 家裡｜10–12 深夜與同儕｜13 神器之間｜14 風暴將至｜15 決戰古神</p>
          <p style={{ fontSize: 12.5, color: cleared ? habit.color : "var(--gold)", marginTop: 8, textShadow: "0 1px 6px #000" }}>
            本層星數 {hs} / {HABIT_STAR_GATE}★　{cleared ? "✦ 已斬古神，下一層已開啟！" : pc === LEVELS_PER_HABIT ? `15 關全過了，再磨亮 ${HABIT_STAR_GATE - hs} 顆星就能斬古神（重玩把 ★★ 拚成 ★★★）` : `要 15 關全過 + 滿 ${HABIT_STAR_GATE}★ 才能斬古神`}
          </p>
          <p style={{ fontSize: 12.5, color: "#8a8694", marginTop: 6, textShadow: "0 1px 6px #000" }}>★★ 以上算過關，成績取最佳。⚠️ 一關內連選 {TRAP_FAIL_LIMIT} 個錯誤（陷阱）選項，當場失敗。</p>
        </div>
      </>
    );
  }

  if (phase === "play") {
    const stageScene = sceneFor(habitN, levelN, player?.gender);
    if (sceneIdx === -1) {
      return (
        <>
          <Stage img={stageScene.img} fallback={stageScene.fallback} />
          <div className="play-col" style={{ "--accent": habit.color, cursor: "pointer" }} onClick={nextScene}>
            <div className="topbar" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setPhase("levels")}>← 放棄這次挑戰</button>
              <span>{habit.name}・第 {levelN} 關</span>
            </div>
            <div className="spacer" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p className="title-en" style={{ color: habit.color }}>{stageScene.act}</p>
              <h3 style={{ color: habit.color, textAlign: "center", fontSize: 26, letterSpacing: 4, margin: "6px 0", textShadow: "0 2px 16px #000" }}>{level.title}</h3>
            </div>
            <div className="dialog-area">
              <div className="dialog-box">
                <p className="dlg-text">{level.intro}</p>
              </div>
              <p className="tap-hint" style={{ marginTop: 16 }}>點 擊 繼 續</p>
            </div>
          </div>
        </>
      );
    }
    const scene = level.scenes[sceneIdx];
    const choice = picked !== null ? scene.choices[picked] : null;
    // 古神反應 + 劍靈隱藏低語：用 runSeed 推導，確保同一次選擇穩定、重玩才變
    const seedBase = runSeed + sceneIdx * 13 + (picked ?? 0) * 7;
    const godPool = choice ? (choice.q === 2 ? GOD_LINES[habitN].defeat : GOD_LINES[habitN].taunt) : null;
    const godLine = godPool ? godPool[seedBase % godPool.length] : null;
    const rareLine = choice && seedBase % 12 === 0 ? SWORD_RARE[seedBase % SWORD_RARE.length] : null;
    return (
      <>
        <Stage img={stageScene.img} fallback={stageScene.fallback} />
        <div className="play-col" style={{ "--accent": habit.color }}>
          <div className="topbar" style={{ marginBottom: 8 }}>
            <button onClick={() => setPhase("levels")}>← 放棄</button>
            <span>{level.title}　{sceneIdx + 1} / {level.scenes.length}</span>
            <span className="sword-energy" style={{ marginBottom: 0 }}>⚡ {earned} / {maxPts}</span>
          </div>
          <div className="progress-track" style={{ margin: "0 0 8px" }}><div className="progress-fill" style={{ width: `${((sceneIdx) / level.scenes.length) * 100}%` }} /></div>
          <div className="spacer" />
          <div className="dialog-area">
            {!choice ? (
              <>
                <div className="dialog-box">
                  <span className="who">{stageScene.act}</span>
                  <p className="dlg-text">{scene.text}</p>
                </div>
                <div style={{ marginTop: 4 }}>
                  {shuffledOrder(scene.choices.length, runSeed + sceneIdx * 101).map((oi) => (
                    <button key={oi} className="btn" style={{ background: "rgba(10,11,16,.62)", marginTop: 8 }} onClick={() => pick(oi)}>
                      {scene.choices[oi].t}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="dlg-echo">你的選擇：{choice.t}</div>
                {godLine && (
                  <div className="dialog-box" style={{ borderLeft: "3px solid var(--accent)", opacity: 0.92 }}>
                    <span className="who" style={{ color: habit.color }}>{habit.god}</span>
                    <p className="dlg-text">{godLine}</p>
                  </div>
                )}
                <div className="dialog-box" style={{ borderLeft: "3px solid var(--accent)" }}>
                  <span className="who sword">🗡️ 劍 靈</span>
                  <p className="dlg-text">
                    {choice.fb}
                    {choice.q === 2 && <span style={{ color: "var(--gold)" }}>　⚡+2</span>}
                    {choice.q === 1 && <span style={{ color: "var(--dim)" }}>　⚡+1</span>}
                  </p>
                </div>
                {rareLine && (
                  <div className="dlg-echo" style={{ marginTop: 8, fontStyle: "italic", color: "var(--gold)" }}>{rareLine}</div>
                )}
                <div style={{ marginTop: 14 }}>
                  <button className="btn primary" onClick={nextScene}>
                    {runFailed ? "你被纏住了・結 算" : sceneIdx + 1 < level.scenes.length ? "繼 續" : "結 算"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  if (phase === "result") {
    const passed = resultStars >= PASS_STARS;
    const hasNext = levelN < LEVELS_PER_HABIT;
    const resultScene = sceneFor(habitN, levelN, player?.gender);
    return (
      <>
        <Stage img={resultScene.img} fallback={resultScene.fallback} dark={!passed} />
        <div className="wrap center" style={{ "--accent": habit.color }}>
          <p className="title-en" style={{ color: habit.color }}>{passed ? "Victory" : "Try Again"}</p>
          <h3 style={{ color: habit.color, textAlign: "center", fontSize: 24, letterSpacing: 4, textShadow: "0 2px 14px #000" }}>{level.title}</h3>
          <div className="stars">{"★".repeat(resultStars)}{"☆".repeat(3 - resultStars)}</div>
          <p className="narration" style={{ fontWeight: 700, marginBottom: 14 }}>{passed ? (level.type === "boss" ? `你斬落了${habit.god}！` : "通過！") : runFailed ? "你連續踩進古神的陷阱，當場被絲線纏住——這一關判定失敗。" : "古神的絲線還纏著你⋯⋯再試一次"}</p>
          <p className="narration" style={{ fontSize: 15.5, color: passed ? "var(--text)" : "var(--dim)" }}>
            {passed ? level.outro : runFailed ? "亂猜會被反噬。重新進關，先看懂題目，再下劍——連踩兩個錯誤選項就會直接出局。" : "別擔心，這裡不是考試。重新進關，注意劍靈的提示——哪些選擇讓劍充能、哪些讓絲線收緊。"}
          </p>
          <div style={{ marginTop: 30 }}>
            {!passed && <button className="btn primary" onClick={() => startLevel(habitN, levelN)}>再 戰 一 次</button>}
            {passed && hasNext && levelUnlocked(habitN, levelN + 1) && (
              <button className="btn primary" onClick={() => startLevel(habitN, levelN + 1)}>下 一 關</button>
            )}
            {passed && !hasNext && (
              <button className="btn primary" onClick={() => setPhase("map")}>回深淵地圖・前往下一層</button>
            )}
            <button className="btn ghost" style={{ width: "auto", minWidth: 200, margin: "10px auto 0" }} onClick={() => setPhase("levels")}>回關卡列表</button>
            {passed && <button className="btn ghost" style={{ width: "auto", minWidth: 200, margin: "10px auto 0" }} onClick={() => startLevel(habitN, levelN)}>重玩這關（複習）</button>}
          </div>
        </div>
      </>
    );
  }

  return null;
}
