"use client";

// 首頁：開放給訪客試玩（不顯示學生登入、進度不保存）。
import GameApp from "@/app/game-app";

export default function Home() {
  return <GameApp allowStudent={false} />;
}
