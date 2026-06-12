// 每層 15 關共用的「幕」結構：關卡編號 → 場景圖與幕名。
// 校園／家庭／深夜場景分男女主角版本；古神、Boss、綜合關用該層主視覺。
export function sceneFor(habitN, levelN, gender) {
  const g = gender === "F" ? "f" : "m";
  if (levelN === 1) return { img: `/layers/${habitN}.jpg`, act: "序幕・墜入" };
  if (levelN <= 5) return { img: `/scenes/school-${g}.jpg`, act: "第一幕・校園" };
  if (levelN <= 9) return { img: `/scenes/home-${g}.jpg`, act: "第二幕・家裡" };
  if (levelN <= 12) return { img: `/scenes/night-${g}.jpg`, act: "第三幕・深夜與同儕" };
  if (levelN === 13) return { img: "/scenes/tool.jpg", act: "神器之間" };
  if (levelN === 14) return { img: `/layers/${habitN}.jpg`, act: "第四幕・風暴將至" };
  return { img: `/layers/${habitN}.jpg`, act: "終幕・決戰古神" };
}
