// 不讓搜尋引擎索引整站（尤其是隱藏的 /STU 學生入口）
export default function robots() {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
