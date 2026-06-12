import h1 from "@/content/habit1.json";
import h2 from "@/content/habit2.json";
import h3 from "@/content/habit3.json";
import h4 from "@/content/habit4.json";
import h5 from "@/content/habit5.json";
import h6 from "@/content/habit6.json";
import h7 from "@/content/habit7.json";

export const CONTENT = { 1: h1, 2: h2, 3: h3, 4: h4, 5: h5, 6: h6, 7: h7 };

export function getLevel(habit, level) {
  return CONTENT[habit].levels[level - 1];
}
