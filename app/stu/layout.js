// 學生入口不希望被搜尋引擎索引（靠網址保密），但不寫進 robots.txt 以免曝光路徑。
export const metadata = {
  robots: { index: false, follow: false },
};

export default function StuLayout({ children }) {
  return children;
}
