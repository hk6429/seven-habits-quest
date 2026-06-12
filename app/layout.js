import "./globals.css";

export const metadata = {
  title: "心之深淵：選擇之劍｜七個習慣闖關",
  description: "持選擇之劍，連闖七層深淵，斬七尊壞習慣古神，奪回人生主導權。",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0f14",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
