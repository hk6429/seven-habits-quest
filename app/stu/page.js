"use client";

// 學生入口：開放學生登入（班級座號 / Google），進度會保存。
import GameApp from "@/app/game-app";

export default function StudentEntry() {
  return <GameApp allowStudent={true} />;
}
