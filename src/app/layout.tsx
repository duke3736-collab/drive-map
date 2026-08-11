import type { Metadata, Viewport } from "next";
import Script from "next/script";
import CollapsibleAdBanner from "@/components/CollapsibleAdBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drive Map (드라이브 맵) - 전국 감성 드라이브 코스 & 데이트 코스 추천",
  description: "전국 최고의 감성 드라이브 코스 지도를 확인하세요. 서울 근교, 경기도, 인천, 야경, 해안도로 등 상황별 맞춤 데이트 코스 추천과 주변 핫플레이스 정보까지 드라이브 맵에서 한눈에 제공합니다.",
  keywords: [
    "드라이브 코스", "드라이브 코스 추천", "서울 근교 드라이브", "경기도 드라이브 코스",
    "야경 드라이브 코스", "해안도로 드라이브", "데이트 코스 추천", "주말 갈만한곳",
    "전국 드라이브 지도", "드라이브 맵", "위크뉴스 드라이브", "weknews drive",
    "남양주 드라이브", "가평 드라이브", "양평 드라이브", "포천 드라이브", "강화도 드라이브",
    "인천 드라이브", "부산 드라이브", "강원도 드라이브", "제주도 드라이브", "벚꽃 드라이브",
    "단풍 드라이브", "노을 데이트", "초보운전 드라이브", "주말 나들이", "힐링 드라이브"
  ],
  manifest: "/manifest.json",
  openGraph: {
    title: "Drive Map (드라이브 맵) - 전국 감성 드라이브 코스 & 데이트 코스 추천",
    description: "전국 최고의 감성 드라이브 코스 지도를 확인하세요. 상황별 맞춤 데이트 코스 추천과 주변 핫플레이스 정보를 한눈에!",
    url: "https://drive.weknews.com",
    siteName: "Drive Map",
    images: [
      {
        url: "https://drive.weknews.com/images/hero.png",
        width: 1200,
        height: 630,
        alt: "Drive Map - 전국 감성 드라이브 코스",
      }
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Drive Map (드라이브 맵) - 전국 감성 드라이브 코스",
    description: "전국 최고의 감성 드라이브 코스 지도를 확인하세요. 데이트 코스 추천과 주변 핫플레이스 정보를 한눈에!",
    images: ["https://drive.weknews.com/images/hero.png"],
  },
  verification: {
    other: {
      "naver-site-verification": ["3faa2ef84f296409fbaf72f26f3836e630fc369a"],
    },
    google: "cb7c8a0dcbef9467",
  },
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
    <html lang="ko" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6635245275061755"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-HXGF6RRRQT`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-HXGF6RRRQT', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body 
        suppressHydrationWarning 
        className="bg-slate-900 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white"
      >
        <main suppressHydrationWarning className="w-full min-h-screen bg-slate-950 relative flex flex-col">
          {/* 상단 접이식 애드센스 광고 배너 */}
          <CollapsibleAdBanner position="top" dataAdSlot="4564542487" />

          <div className="flex-1 relative w-full h-full">
            {children}
          </div>

          {/* 하단 접이식 애드센스 광고 배너 */}
          <CollapsibleAdBanner position="bottom" dataAdSlot="4564542487" />
        </main>
      </body>
    </html>
  );
}
