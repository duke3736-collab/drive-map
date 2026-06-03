import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drive Map - 전국 감성 드라이브 코스",
  description: "답답한 도심을 벗어나 완벽한 궤적을 그리며 달려보세요. 전국 드라이브 코스와 주변 핫플을 한눈에!",
  manifest: "/manifest.json",
  openGraph: {
    title: "Drive Map - 전국 감성 드라이브 코스",
    description: "답답한 도심을 벗어나 완벽한 궤적을 그리며 달려보세요.",
    url: "https://drive.weknews.com",
    siteName: "Drive Map",
    images: [
      {
        url: "https://drive.weknews.com/images/hero.png",
        width: 1200,
        height: 630,
      }
    ],
    locale: "ko_KR",
    type: "website",
  },
  verification: {
    other: {
      "naver-site-verification": ["3faa2ef84f296409fbaf72f26f3836e630fc369a"],
    },
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
        className="bg-slate-900 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white overscroll-none"
      >
        <main suppressHydrationWarning className="fixed inset-0 w-full h-full bg-slate-950 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
