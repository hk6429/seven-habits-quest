// 全站設定 — 改這裡就好，不用動程式

// 班級清單（依學校實際班級數增減）
export const CLASSES = [
  "801", "802", "803", "804", "805", "806",
  "807", "808", "809", "810", "811", "812",
];

export const MAX_SEAT = 40;

// 星等門檻（得分比例）
export const STAR_THRESHOLDS = { three: 0.85, two: 0.6, one: 0.35 };
export const PASS_STARS = 2; // 幾顆星算過關

export const LEVELS_PER_HABIT = 15;

export const HABITS = [
  {
    n: 1, name: "主動積極", god: "傀儡古神・他咎",
    tagline: "在別人做了什麼、跟你要怎麼回應之間，有一個屬於你的 0.5 秒。",
    godIntro: "深淵第一層。無數怨言化成的絲線在黑暗中蠕動，操控著被纏住的人偶。牠的口頭禪是——「都是別人害的」。",
    color: "#e25555",
  },
  {
    n: 2, name: "以終為始", god: "迷航古神・無向",
    tagline: "你想變成什麼樣的人，決定了你現在要做什麼。",
    godIntro: "深淵第二層。一座沒有出口的無限迴廊，霧中每條路都通回原點。在這裡迷路的人，連自己要去哪都想不起來。",
    color: "#5577dd",
  },
  {
    n: 3, name: "要事第一", god: "急湧古神・千急",
    tagline: "重要但還沒火燒屁股的事，才是決定你品質的事。",
    godIntro: "深淵第三層。「緊急瑣事」雜兵如海嘯般無窮湧出，殺得越多，深處的本體就越強壯。",
    color: "#e0913f",
  },
  {
    n: 4, name: "雙贏思維", god: "零和古神・獨贏",
    tagline: "兩個人都不用輸。如果一定有人輸，那就先不成交。",
    godIntro: "深淵第四層。一座競技場，規則只有一條：必有一方倒下。而站在對面的，是長得跟你一模一樣的鏡像。",
    color: "#a55fd6",
  },
  {
    n: 5, name: "知彼解己", god: "喧囂古神・搶答",
    tagline: "先懂他，再讓他懂你。",
    godIntro: "深淵第五層。整層轟鳴著蓋過一切的噪音，你一開口、一出招，全部都會被反彈回來。",
    color: "#3bbcb0",
  },
  {
    n: 6, name: "統合綜效", god: "齊一古神・同化",
    tagline: "不是你的方式，不是我的方式，是更好的第三個方式。",
    godIntro: "深淵第六層。萬物正在被染成同一種灰色。單一屬性的攻擊，對牠完全無效。",
    color: "#4caf6d",
  },
  {
    n: 7, name: "不斷更新", god: "耗竭古神・枯磨",
    tagline: "身體、大腦、心情、朋友——四個面向都要充電，不然前面六關會一個一個壞掉。",
    godIntro: "深淵最底層。打不死的消耗戰，你的每一次攻擊都在流失自己。場上有四座泉——這是唯一的活路。",
    color: "#d8b24a",
  },
];

export function calcStars(earned, max) {
  const pct = max > 0 ? earned / max : 0;
  if (pct >= STAR_THRESHOLDS.three) return 3;
  if (pct >= STAR_THRESHOLDS.two) return 2;
  if (pct >= STAR_THRESHOLDS.one) return 1;
  return 0;
}
