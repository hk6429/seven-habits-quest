// 首頁刻意不放任何學生入口或連結。
// 學生遊戲在隱藏網址 /STU，需老師手動公布、手動輸入網址才進得去。
export const metadata = { title: "竹光國中・自我領導力課程" };

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0b10",
        color: "#6b6878",
        fontFamily: '"Noto Serif TC","Songti TC",serif',
        textAlign: "center",
        padding: 24,
      }}
    >
      <div>
        <p style={{ letterSpacing: 6, fontSize: 14, margin: 0 }}>竹光國中・自我領導力課程</p>
        <p style={{ fontSize: 12, marginTop: 14, color: "#46434f" }}>本頁無公開內容</p>
      </div>
    </div>
  );
}
