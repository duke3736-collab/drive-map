import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "드라이브 맵 (Drive Map) - 전국 감성 드라이브 코스 추천",
  description: "야경, 해안도로, 벚꽃길 등 전국 드라이버들을 위한 숨은 드라이브 코스 지도입니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-slate-900 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <main className="w-full min-h-screen bg-slate-950 relative shadow-2xl overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
