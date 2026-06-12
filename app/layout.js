import { Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const serif = Noto_Serif_TC({ weight: ["400", "600", "900"], subsets: ["latin"], display: "swap" });

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
      <body className={serif.className}>{children}</body>
    </html>
  );
}
