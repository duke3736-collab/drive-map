"use client";

import { useState, useEffect } from "react";

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstruction, setShowIOSInstruction] = useState(false);

  useEffect(() => {
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
        className="w-full group inline-flex flex-row items-center gap-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/50"
      >
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 group-hover:rotate-12 transition-transform duration-300">
          <span className="text-2xl drop-shadow-md">📱</span>
          <span className="absolute -top-1 -right-1 text-xs animate-pulse">✨</span>
        </div>
        <div className="text-left flex-1">
          <div className="text-white font-black flex items-center gap-2 tracking-tight text-base">
            앱으로 1초만에 접속하기
            <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse font-bold">무료</span>
          </div>
          <div className="text-slate-400 text-xs mt-0.5 font-medium leading-relaxed">
            바탕화면에 설치하고 언제든 바로 꺼내보세요!
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-300 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-400 transition-colors shrink-0 shadow-inner">
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
