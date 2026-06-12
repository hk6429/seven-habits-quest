// 關卡 → 場景圖對應。
// 優先用每關獨立圖 /scenes/levels/hX-lY-{m,f}.jpg（批次生成中，逐習慣上線）；
// 還沒生出來的關卡由 Stage 的 CSS 多層背景自動退回「幕」共用場景。
export function sceneFor(habitN, levelN, gender) {
  const g = gender === "F" ? "f" : "m";
  let act, fallback;
  if (levelN === 1) { act = "序幕・墜入"; fallback = `/layers/${habitN}.jpg`; }
  else if (levelN <= 5) { act = "第一幕・校園"; fallback = `/scenes/school-${g}.jpg`; }
  else if (levelN <= 9) { act = "第二幕・家裡"; fallback = `/scenes/home-${g}.jpg`; }
  else if (levelN <= 12) { act = "第三幕・深夜與同儕"; fallback = `/scenes/night-${g}.jpg`; }
  else if (levelN === 13) { act = "神器之間"; fallback = "/scenes/tool.jpg"; }
  else if (levelN === 14) { act = "第四幕・風暴將至"; fallback = `/layers/${habitN}.jpg`; }
  else { act = "終幕・決戰古神"; fallback = `/layers/${habitN}.jpg`; }
  const img = levelN === 13
    ? `/scenes/levels/h${habitN}-l13.jpg`
    : `/scenes/levels/h${habitN}-l${levelN}-${g}.jpg`;
  return { img, fallback, act };
}
