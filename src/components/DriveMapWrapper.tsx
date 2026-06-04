"use client";

import dynamic from "next/dynamic";

const DriveMapClient = dynamic(() => import("@/components/DriveMapClient"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 font-bold z-50">
      <span className="text-4xl animate-spin mb-4">🌀</span>
      <p>드라이브 맵 로딩 중...</p>
    </div>
  )
});

export default function DriveMapWrapper() {
  return <DriveMapClient />;
}
