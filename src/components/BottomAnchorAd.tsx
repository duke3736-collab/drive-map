"use client";

import React, { useState } from "react";
import AdBanner from "./AdBanner";

interface BottomAnchorAdProps {
  dataAdSlot?: string;
}

export default function BottomAnchorAd({
  dataAdSlot = "4564542487",
}: BottomAnchorAdProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-2 pointer-events-none flex flex-col items-center">
      {/* 쏙 내려가기/올라오기 탭 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-t border-x border-slate-700/80 rounded-t-xl px-5 py-1 text-xs font-black shadow-lg flex items-center justify-center gap-1 transition-all cursor-pointer -mb-px"
        title={isOpen ? "광고 숨기기" : "광고 펼치기"}
      >
        <span className="text-sm font-black transform transition-transform duration-300" style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }}>
          ∨
        </span>
      </button>

      {/* 광고 박스 (사진처럼 하단 중앙 둥근 플로팅 카드) */}
      {isOpen && (
        <div className="pointer-events-auto w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] rounded-t-2xl p-2 flex justify-center items-center overflow-hidden transition-all duration-300">
          <AdBanner dataAdSlot={dataAdSlot} dataAdFormat="auto" dataFullWidthResponsive={true} />
        </div>
      )}
    </div>
  );
}
