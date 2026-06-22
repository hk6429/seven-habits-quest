import { NextResponse } from "next/server";
import { loadAllStudents } from "@/lib/store";
import { CLASSES, HABITS, LEVELS_PER_HABIT, PASS_STARS } from "@/lib/config";

// 任務二：班級榮耀榜（集體進度，不曝光個人姓名/分數，純鼓勵）
function passedCount(levels, n) {
  let c = 0;
  for (let l = 1; l <= LEVELS_PER_HABIT; l++) {
    if ((levels?.[`${n}-${l}`]?.stars || 0) >= PASS_STARS) c++;
  }
  return c;
}

export async function POST(req) {
  const { cls } = await req.json();
  if (!CLASSES.includes(cls)) {
    return NextResponse.json({ error: "班級不正確" }, { status: 400 });
  }
  const mine = (await loadAllStudents()).filter((s) => s.cls === cls && !s.guest);
  let totalPassed = 0;
  const gods = HABITS.map((h) => {
    let defeatedBy = 0;
    for (const s of mine) {
      const pc = passedCount(s.levels, h.n);
      totalPassed += pc;
      if (pc === LEVELS_PER_HABIT) defeatedBy++;
    }
    return { n: h.n, name: h.name, god: h.god, color: h.color, defeatedBy };
  });
  const godsDefeated = gods.filter((g) => g.defeatedBy > 0).length;
  return NextResponse.json({ students: mine.length, totalPassed, godsDefeated, gods });
}
