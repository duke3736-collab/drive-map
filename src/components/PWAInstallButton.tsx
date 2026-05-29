"use client";

import { useState, useEffect } from "react";

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstruction, setShowIOSInstruction] = useState(false);

  useEffect(() => {
    // 1. Service Worker 등록 (PWA 필수 조건)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered', reg))
        .catch((err) => console.error('Service Worker registration failed', err));
    }

    // 2. 설치 프롬프트 이벤트 리스너 등록
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstruction(true);
      setTimeout(() => setShowIOSInstruction(false), 5000);
    } else {
      alert("브라우저 메뉴(⋮)에서 '홈 화면에 추가' 또는 '앱 설치'를 선택해주세요.");
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center mb-6">
      <button 
        onClick={handleInstallClick}
        className="w-full group inline-flex flex-row items-center gap-4 bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl hover:shadow-cyan-500/10 hover:border-cyan-500/40"
      >
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/30 group-hover:rotate-12 transition-transform duration-300">
          <span className="text-2xl drop-shadow-md">🏎️</span>
          <span className="absolute -top-1 -right-1 text-xs animate-pulse">⚡</span>
        </div>
        <div className="text-left flex-1 min-w-0">
          <div className="text-white font-black flex flex-wrap items-center gap-1.5 tracking-tight text-[15px]">
            <span className="whitespace-nowrap">앱으로 1초만에 접속하기</span>
            <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse font-bold shrink-0">무료</span>
          </div>
          <div className="text-zinc-400 text-xs mt-1 font-medium leading-tight break-keep">
            바탕화면에 설치하고 언제든 바로 꺼내보세요!
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:bg-cyan-500 group-hover:text-black group-hover:border-cyan-400 transition-colors shrink-0 shadow-inner">
          <span className="text-sm font-black">➔</span>
        </div>
      </button>

      {showIOSInstruction && (
        <div className="absolute top-full mt-4 bg-slate-800 text-slate-100 p-4 rounded-2xl shadow-2xl border border-slate-700 text-sm w-full animate-in slide-in-from-top-2 z-50">
          <div className="font-bold mb-2 flex items-center gap-2 text-indigo-400">
            <span className="text-xl">🍎</span> 아이폰(iOS) 설치 방법
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>화면 하단의 <b>공유 버튼(가운데 화살표)</b>을 누르세요.</li>
            <li>메뉴를 올려 <b>'홈 화면에 추가'</b>를 선택하세요.</li>
            <li>우측 상단의 <b>'추가'</b>를 누르면 끝!</li>
          </ol>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 border-t border-l border-slate-700 rotate-45"></div>
        </div>
      )}
    </div>
  );
}
