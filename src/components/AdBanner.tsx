"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
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
