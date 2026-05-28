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
    <div className="relative w-full flex flex-col items-center mt-4">
      <button 
        onClick={handleInstallClick}
        className="w-full group inline-flex flex-row items-center gap-4 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
      >
        <div className="text-3xl group-hover:animate-bounce">📱</div>
        <div className="text-left flex-1">
          <div className="text-slate-100 font-bold flex items-center gap-2">
            드라이브 맵 앱 설치하기
            <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full shadow-sm animate-pulse">무료</span>
          </div>
          <div className="text-slate-400 text-xs mt-1">
            홈 화면에 추가하고 주말마다 편하게 꺼내보세요!
          </div>
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
