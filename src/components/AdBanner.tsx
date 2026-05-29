"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  dataAdSlot: string;
  dataAdFormat: string;
  dataFullWidthResponsive: boolean;
}

export default function AdBanner({
  dataAdSlot,
  dataAdFormat,
  dataFullWidthResponsive,
}: AdBannerProps) {
  const isPushed = useRef(false);

  useEffect(() => {
    // 이미 푸시되었거나, 브라우저 환경이 아니면 실행하지 않음
    if (isPushed.current || typeof window === 'undefined') return;

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      isPushed.current = true;
    } catch (error) {
      console.error("AdSense error:", error);
    }
  }, []);

  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center">
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client="ca-pub-6635245275061755"
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive.toString()}
      />
    </div>
  );
}
