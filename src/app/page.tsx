"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import AdBanner from "@/components/AdBanner";
import PWAInstallButton from "@/components/PWAInstallButton";

declare global {
  interface Window {
    kakao: any;
    Kakao: any;
  }
}

interface Course {
  id: number;
  title: string;
  description: string;
  theme: string;
  tags: string;
  distance: string;
  duration: string;
  waypoints: string;
  imageUrl?: string;
}

interface ParsedWaypoint {
  name: string;
  lat: number;
  lng: number;
}

declare global {
  interface Window {
    kakao: any;
  }
}

const KAKAO_APP_KEY = "11032eefd7d0111cb94d93c0ab41eb01";
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzfw4oZwWHAan-m8F4-l0eq5JBZFyvfRQmvvl5PqQTCEhlDsNiGxmi0n_aUxzYjrV6W/exec";

export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  // 이미 서버에서 받아온 도로 좌표 및 실시간 거리/시간 캐싱
  const cachedPathsRef = useRef<Record<number, { path: any[], distance?: number, duration?: number }>>({});

  const [mapLoaded, setMapLoaded] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTheme, setActiveTheme] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSplash, setShowSplash] = useState(true);

  // 바텀 시트 스와이프를 위한 Motion Value 및 Ref
  const sheetY = useMotionValue(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCourse) sheetY.set(0);
  }, [selectedCourse, sheetY]);

  // 뒤로가기 및 닫기 공통 함수
  const closeCourse = () => {
    setSelectedCourse(null);
    if (window.location.hash === '#course') {
      window.history.back(); // 해시 제거
    }
  };

  // 브라우저 뒤로가기 감지 (해시 변경 감지)
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash !== '#course') {
        setSelectedCourse(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 코스 선택 시 URL 해시 추가 (히스토리 스택에 쌓기)
  useEffect(() => {
    if (selectedCourse && window.location.hash !== '#course') {
      window.location.hash = 'course';
    }
  }, [selectedCourse]);

  // Derived state for filtering
  const filteredCourses = courses.filter(c => {
    if (activeTheme !== 'all' && c.theme !== activeTheme) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      if (!c.title.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q) && !c.tags.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const themes = [
    { id: "야경 드라이브", icon: "🌃", label: "야경 드라이브" },
    { id: "해안도로", icon: "🌊", label: "해안도로" },
    { id: "숲속/계곡", icon: "🌲", label: "숲속/계곡" },
    { id: "카페/데이트", icon: "☕", label: "카페/데이트" },
  ];

  // 구글 시트 데이터 로드
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch(GOOGLE_SHEET_URL);
        const rawData = await res.json();
        
        // 공백 제거 (키 및 문자열 값의 앞뒤 공백/줄바꿈 모두 제거)
        const data = rawData.map((item: any) => {
          const cleanItem: any = {};
          Object.keys(item).forEach(key => {
            const val = item[key];
            cleanItem[key.trim()] = typeof val === 'string' ? val.trim() : val;
          });
          return cleanItem;
        });

        setCourses(data.filter((item: any) => item.id));
      } catch (e) {
        console.error("데이터 로드 실패", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // 지도 초기화
  const initMap = () => {
    if (!window.kakao || !window.kakao.maps || mapLoaded) return;

    window.kakao.maps.load(() => {
      if (!mapContainerRef.current) return;
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 10,
      };
      const map = new window.kakao.maps.Map(mapContainerRef.current, options);
      mapRef.current = map;
      
      const updateMarkerScale = () => {
        const level = map.getLevel();
        let scale = 1;
        if (level <= 4) scale = 1.8;
        else if (level <= 6) scale = 1.5;
        else if (level <= 8) scale = 1.2;
        else if (level <= 10) scale = 1.0;
        else scale = 0.8;
        document.documentElement.style.setProperty('--marker-scale', scale.toString());
      };
      updateMarkerScale();
      window.kakao.maps.event.addListener(map, 'zoom_changed', updateMarkerScale);

      // 브라우저 리사이즈 시 지도 크기 재계산 (PC/모바일 전환 시 깨짐 방지)
      window.addEventListener('resize', () => {
        if (mapRef.current) mapRef.current.relayout();
      });

      setMapLoaded(true);
    });
  };

  useEffect(() => {
    if (mapLoaded) return;
    const interval = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        clearInterval(interval);
        initMap();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [mapLoaded]);

  const parseWaypoints = (str: string): ParsedWaypoint[] => {
    if (!str) return [];
    return str.split('|').map(pt => {
      const parts = pt.split(',');
      return {
        name: parts[0] || "",
        lat: parseFloat(parts[1] || "0"),
        lng: parseFloat(parts[2] || "0")
      };
    });
  };

  // 코스 그리기 (도로망 연동 반영)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || courses.length === 0) return;

    // 기존 리셋
    polylinesRef.current.forEach(p => p.setMap(null));
    markersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current = [];
    markersRef.current = [];

    filteredCourses.forEach(async (course) => {
      const waypoints = parseWaypoints(course.waypoints);
      if (waypoints.length < 2) return;
      
      const isSelected = selectedCourse?.id === course.id;

      // 1. 마커 그리기
      [waypoints[0], waypoints[waypoints.length - 1]].forEach((wp, idx) => {
        const isStart = idx === 0;
        const contentNode = document.createElement('div');
        contentNode.innerHTML = `
          <div class="relative flex flex-col items-center cursor-pointer transition-transform hover:scale-110 z-10 ${isSelected ? 'scale-125 z-20' : ''}" style="transform: scale(var(--marker-scale, 1)); transform-origin: bottom center;">
            <div class="bg-slate-900 border-2 ${isStart ? 'border-indigo-400' : 'border-rose-400'} text-white text-xs md:text-sm font-bold px-3 py-1 rounded-full shadow-lg mb-1 whitespace-nowrap">
              ${wp.name}
            </div>
            <div class="w-5 h-5 rounded-full ${isStart ? 'bg-indigo-500' : 'bg-rose-500'} border-[3px] border-white shadow-md"></div>
          </div>
        `;
        contentNode.onclick = () => handleCourseClick(course, waypoints);

        const customOverlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(wp.lat, wp.lng),
          content: contentNode,
          yAnchor: 1
        });
        customOverlay.setMap(mapRef.current);
        markersRef.current.push(customOverlay);
      });

      // 2. 도로에 밀착된 선(Polyline) 그리기
      let pathCoordinates: any[] = [];
      let realDistance: number | undefined;
      let realDuration: number | undefined;
      
      if (cachedPathsRef.current[course.id]) {
        // 이미 한 번 구한 적 있으면 캐시 사용 (빠름)
        pathCoordinates = cachedPathsRef.current[course.id].path;
        drawPolyline(course, pathCoordinates, waypoints, isSelected);
      } else {
        // 없으면 카카오 서버에서 길찾기 연산 받아오기
        try {
          const res = await fetch('/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waypoints })
          });
          const naviData = await res.json();
          
          if (naviData.routes && naviData.routes.length > 0) {
            const route = naviData.routes[0];
            realDistance = route.summary.distance; // 미터 단위
            realDuration = route.summary.duration; // 초 단위

            const sections = route.sections;
            sections.forEach((section: any) => {
              section.roads.forEach((road: any) => {
                for (let i = 0; i < road.vertexes.length; i += 2) {
                  // 카카오 API는 [lng, lat] 순서로 줍니다. LatLng 에는 (lat, lng) 순서로 넣습니다.
                  const lng = road.vertexes[i];
                  const lat = road.vertexes[i+1];
                  pathCoordinates.push(new window.kakao.maps.LatLng(lat, lng));
                }
              });
            });
          } else {
            // 실패 시 직선 폴백
            pathCoordinates = waypoints.map(wp => new window.kakao.maps.LatLng(wp.lat, wp.lng));
          }

          cachedPathsRef.current[course.id] = { path: pathCoordinates, distance: realDistance, duration: realDuration };
          drawPolyline(course, pathCoordinates, waypoints, isSelected);

        } catch (e) {
          console.error(e);
          pathCoordinates = waypoints.map(wp => new window.kakao.maps.LatLng(wp.lat, wp.lng));
          drawPolyline(course, pathCoordinates, waypoints, isSelected);
        }
      }
    });

  }, [courses, mapLoaded, activeTheme, selectedCourse, searchQuery]);

  const drawPolyline = (course: Course, path: any[], waypoints: ParsedWaypoint[], isSelected: boolean) => {
    if (!mapRef.current) return;
    
    const polyline = new window.kakao.maps.Polyline({
      path: path,
      strokeWeight: isSelected ? 10 : 6,
      strokeColor: isSelected ? '#EF4444' : '#3B82F6', // 선택 시 진한 빨강, 미선택 시 파랑
      strokeOpacity: isSelected ? 1 : 0.8,
      strokeStyle: 'solid',
      zIndex: isSelected ? 10 : 1
    });
    polyline.setMap(mapRef.current);
    polylinesRef.current.push(polyline);

    window.kakao.maps.event.addListener(polyline, 'click', () => {
      handleCourseClick(course, waypoints);
    });
  };

  const handleCourseClick = (course: Course, waypoints: ParsedWaypoint[]) => {
    setSelectedCourse(course);
    
    if (mapRef.current && waypoints.length > 0) {
      const midIdx = Math.floor(waypoints.length / 2);
      const moveLatLon = new window.kakao.maps.LatLng(waypoints[midIdx].lat, waypoints[midIdx].lng);
      mapRef.current.panTo(moveLatLon);
    }
  };

  const findMyLocation = () => {
    if (!navigator.geolocation) {
      alert("현재 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (mapRef.current) {
        const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
        mapRef.current.panTo(moveLatLon);
        mapRef.current.setLevel(5);
        
        const content = `<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md animate-pulse"></div>`;
        const customOverlay = new window.kakao.maps.CustomOverlay({
          position: moveLatLon,
          content: content,
        });
        customOverlay.setMap(mapRef.current);
      }
    }, () => {
      alert("스마트폰/브라우저의 위치 접근 권한을 허용해주세요!");
    });
  };

  const renderCourseDetails = (isDesktop: boolean) => {
    if (!selectedCourse) return null;
    return (
      <div className="space-y-4">
        {/* 코스 풍경 사진 (이미지 URL이 있을 경우에만 렌더링) */}
        {selectedCourse.imageUrl && (
          <div 
            className="w-full h-48 bg-slate-800 rounded-2xl bg-cover bg-center shadow-inner mb-4 border border-slate-700"
            style={{ backgroundImage: `url("${selectedCourse.imageUrl}")` }}
          ></div>
        )}
        
        <div className="flex gap-2 flex-wrap">
          {selectedCourse.tags.split(' ').map((tag, idx) => (
            <span key={idx} className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-md text-xs font-bold">
              {tag}
            </span>
          ))}
        </div>
        
        <h2 className="text-2xl font-black text-white leading-tight">
          {selectedCourse.title}
        </h2>
        
        <p className="text-slate-300 text-sm leading-relaxed">
          {selectedCourse.description}
        </p>
        
        <div className="flex gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">총 거리</span>
            <span className="font-bold text-slate-100">
              {cachedPathsRef.current[selectedCourse.id]?.distance 
                ? `${(cachedPathsRef.current[selectedCourse.id].distance! / 1000).toFixed(1)}km` 
                : selectedCourse.distance}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">예상 시간</span>
            <span className="font-bold text-slate-100">
              {cachedPathsRef.current[selectedCourse.id]?.duration
                ? `${Math.ceil(cachedPathsRef.current[selectedCourse.id].duration! / 60)}분`
                : selectedCourse.duration}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button 
            onClick={() => {
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              if (!isMobile) {
                alert("🚗 스마트폰에서 접속하셔야 내비게이션 앱이 실행됩니다!\n(PC에서는 내비 어플이 없어서 작동하지 않습니다)");
                return;
              }
              const wps = parseWaypoints(selectedCourse.waypoints);
              if (wps.length > 0) {
                const dest = wps[wps.length - 1];
                window.location.href = `tmap://search?name=${encodeURIComponent(dest.name)}`;
              }
            }}
            className="w-full bg-[#111111] border border-slate-600 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <span className="text-lg">🧭</span> 티맵 안내
          </button>
          <button 
            onClick={() => {
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              if (!isMobile) {
                alert("🚗 스마트폰에서 접속하셔야 카카오내비 앱이 실행됩니다!\n(PC에서는 내비 어플이 없어서 작동하지 않습니다)");
                return;
              }
              const wps = parseWaypoints(selectedCourse.waypoints);
              if (wps.length > 0) {
                const dest = wps[wps.length - 1];
                if (window.Kakao) {
                  if (!window.Kakao.isInitialized()) {
                    window.Kakao.init(KAKAO_APP_KEY);
                  }
                  window.Kakao.Navi.start({
                    name: dest.name,
                    x: dest.lng,
                    y: dest.lat,
                    coordType: 'wgs84'
                  });
                } else {
                  window.location.href = `https://map.kakao.com/link/to/${encodeURIComponent(dest.name)},${dest.lat},${dest.lng}`;
                }
              }
            }}
            className="w-full bg-[#FEE500] hover:bg-[#F4DC00] text-[#191919] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <span className="text-lg">🚕</span> 카카오내비
          </button>
        </div>

        {/* 카카오톡 공유 버튼 */}
        <button 
          onClick={() => {
            if (!window.Kakao) {
              alert("카카오 SDK가 아직 로드되지 않았습니다.");
              return;
            }
            if (!window.Kakao.isInitialized()) {
              window.Kakao.init(KAKAO_APP_KEY);
            }
            
            const url = "https://drive.weknews.com";
            
            window.Kakao.Share.sendDefault({
              objectType: 'feed',
              content: {
                title: `[Drive Map] ${selectedCourse.title}`,
                description: selectedCourse.description,
                imageUrl: selectedCourse.imageUrl || 'https://drive.weknews.com/images/hero.png',
                link: {
                  mobileWebUrl: url,
                  webUrl: url,
                },
              },
              buttons: [
                {
                  title: '코스 자세히 보기',
                  link: {
                    mobileWebUrl: url,
                    webUrl: url,
                  },
                },
              ],
            });
          }}
          className="w-full mt-3 bg-[#FEE500] hover:bg-[#F4DC00] text-[#191919] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
        >
          <span className="text-xl">💬</span> 카카오톡 공유하기
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col md:flex-row relative bg-slate-950 overflow-hidden">
      {/* 이니셜 D 감성의 메인 스플래시 화면 */}
      {showSplash && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-70 scale-105"
            style={{ backgroundImage: "url('/images/hero.png')" }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
          
          <div className="relative z-10 text-center px-6 mt-32">
            <span className="inline-block bg-indigo-600 text-white font-black px-5 py-2 rounded-full text-sm mb-6 shadow-lg shadow-indigo-500/50">
              전국 감성 드라이브 코스
            </span>
            <h1 className="text-6xl font-black text-white mb-4 tracking-tighter drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] italic">
              DRIVE MAP
            </h1>
            <p className="text-slate-200 font-bold mb-12 drop-shadow-md text-lg">
              답답한 도심을 벗어나<br/>완벽한 궤적을 그리며 달려보세요
            </p>
            <button 
              onClick={() => setShowSplash(false)}
              className="bg-white text-slate-900 font-black text-xl px-12 py-5 rounded-full shadow-2xl hover:scale-105 hover:bg-slate-100 transition-all border-4 border-slate-200"
            >
              드라이브 시작하기 🏁
            </button>
          </div>
        </div>
      )}

      <Script 
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`}
        strategy="afterInteractive"
        onLoad={initMap}
      />
      <Script 
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" 
        strategy="lazyOnload"
      />

      {/* 스플래시 화면이 끝난 후에만 구글 애드센스 로드 (첫 화면 하단 앵커 광고 방지) */}
      {!showSplash && (
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6635245275061755"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}

      {/* 지도 컨트롤 (확대/축소/내위치) */}
      <div className="absolute z-20 top-1/2 -translate-y-1/2 right-4 md:transform-none md:top-auto md:bottom-20 md:right-auto md:left-[424px] flex flex-col gap-2 shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
        <button 
          onClick={findMyLocation}
          className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white hover:text-sky-600 transition-colors shadow-sm"
          title="내 위치"
        >
          🎯
        </button>
        <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
          <button 
            onClick={() => mapRef.current?.setLevel(mapRef.current.getLevel() - 1)}
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-white hover:text-sky-600 font-black text-xl border-b border-slate-200 transition-colors"
          >
            +
          </button>
          <button 
            onClick={() => mapRef.current?.setLevel(mapRef.current.getLevel() + 1)}
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-white hover:text-sky-600 font-black text-2xl transition-colors"
          >
            −
          </button>
        </div>
      </div>

      {/* PC 사이드바 / 모바일 상단 헤더 */}
      <div className="
        md:relative md:w-[400px] md:h-full md:bg-slate-900 md:border-r md:border-slate-800 md:flex md:flex-col md:p-6 md:z-20
        absolute top-0 left-0 w-full z-10 p-4 bg-gradient-to-b from-slate-950/80 to-transparent md:bg-none
      ">
        <h1 className="text-xl md:text-3xl font-black text-white mb-3 md:mb-6 tracking-tight flex items-center gap-2">
          <span>🚗</span> Drive Map
        </h1>

        <div className="relative mb-4 w-full shrink-0">
          <input 
            type="text" 
            placeholder="지역, 코스명, 태그 검색 (예: 북한강)" 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              closeCourse();
            }}
            className="w-full bg-slate-800/80 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 shadow-inner"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>

        {/* 선택된 코스가 없을 때만 헤더 요소들(배너, 테마필터)을 보여줍니다 */}
        <AnimatePresence initial={false}>
          {!selectedCourse && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 0 }}
              exit={{ height: 0, opacity: 0, marginTop: -16 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden w-full flex flex-col shrink-0"
            >
              {/* 자사 서비스(씨맵) 크로스 프로모션 배너 및 PWA 설치 */}
              <div className="mb-6">
                <a 
                  href="https://map.weknews.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-4 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:-translate-y-1 transition-all group relative overflow-hidden mb-4"
                >
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-xl group-hover:bg-white/30 transition-colors"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-black text-lg mb-1 flex items-center gap-2 tracking-tight">
                        <span className="text-2xl group-hover:animate-bounce">🌊</span> 여름 물놀이 스팟 찾기
                      </h3>
                      <p className="text-sky-100 text-xs font-semibold">전국 계곡, 해수욕장, 수영장을 씨맵에서 한눈에!</p>
                    </div>
                    <div className="bg-white text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-black shadow-md group-hover:scale-110 transition-transform shrink-0">
                      ➔
                    </div>
                  </div>
                </a>
                <PWAInstallButton />
              </div>

              {/* 테마 필터 */}
              <div className="flex md:flex-wrap overflow-x-auto gap-2 pb-4 scrollbar-hide shrink-0">
                <button 
                  onClick={() => setActiveTheme("all")}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                    activeTheme === "all" 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/30' 
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 backdrop-blur-md'
                  }`}
                >
                  🚙 전체보기
                </button>
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTheme(t.id);
                      setSelectedCourse(null);
                    }}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                      activeTheme === t.id 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/30' 
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 backdrop-blur-md'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PC 전용: 사이드바 코스 디테일 및 광고 영역 */}
        <div className="hidden md:flex flex-col flex-1 overflow-y-auto mt-6 pr-2 custom-scrollbar relative">
          <div className="flex-1 pb-4">
            {selectedCourse ? (
              renderCourseDetails(true)
            ) : filteredCourses.length > 0 && (searchQuery || activeTheme !== 'all') ? (
              <div className="space-y-3">
                <p className="text-slate-300 text-sm font-bold px-2">총 {filteredCourses.length}개의 코스</p>
                {filteredCourses.map(course => (
                  <div 
                    key={course.id} 
                    onClick={() => {
                      setSelectedCourse(course);
                      if (mapRef.current) {
                        const waypoints = parseWaypoints(course.waypoints);
                        if (waypoints.length > 0) {
                          const midIdx = Math.floor(waypoints.length / 2);
                          mapRef.current.panTo(new window.kakao.maps.LatLng(waypoints[midIdx].lat, waypoints[midIdx].lng));
                        }
                      }
                    }}
                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/80 hover:bg-slate-700/80 hover:border-slate-500 transition-all cursor-pointer group shadow-sm"
                  >
                    <h3 className="text-white font-bold mb-1 group-hover:text-indigo-400 transition-colors">{course.title}</h3>
                    <p className="text-slate-300 text-xs line-clamp-2 mb-2">{course.description}</p>
                    <div className="flex gap-2">
                      <span className="text-xs text-indigo-400 font-bold">{course.distance}</span>
                      <span className="text-xs text-slate-400">{course.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 pb-10">
                <span className="text-5xl mb-4">📍</span>
                <p className="font-bold text-lg mb-2 text-slate-400">지도에서 코스를 선택해주세요</p>
                <p className="text-sm text-slate-600 text-center px-4">
                  오른쪽 지도에 표시된 마커를 클릭하시면<br/>상세한 코스 정보와 뷰를 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>
          
          {/* 수익화 배너 영역 (구글 애드센스) - 항상 하단 고정 노출 */}
          <div className="mt-auto pt-6 w-full shrink-0">
            <div className="w-full h-[250px] bg-slate-800/50 rounded-xl overflow-hidden shadow-sm">
              <AdBanner 
                dataAdSlot="4564542487" 
                dataAdFormat="auto" 
                dataFullWidthResponsive={true} 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative bg-slate-900">
        {(!mapLoaded || isLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
            <span className="text-4xl animate-spin mb-4">🌀</span>
            <p className="text-slate-300 font-bold">
              {isLoading ? "코스 데이터를 불러오는 중..." : "지도를 불러오는 중..."}
            </p>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full"></div>

        {/* PC 우측 플로팅 배너 영역 */}
        <div className="hidden md:flex absolute top-6 right-6 z-20 flex-col gap-4 w-[280px] max-h-[calc(100dvh-48px)] overflow-y-auto custom-scrollbar pb-6">
          {/* 첫 번째 플로팅 배너 (구글 애드센스) */}
          <div className="w-full bg-slate-900/80 backdrop-blur-lg rounded-2xl border border-slate-700/80 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col justify-center items-center shrink-0">
            <span className="text-xs text-slate-500 font-bold mb-2">SPONSORED</span>
            <div className="w-full h-[250px] bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border border-slate-700">
              <AdBanner 
                dataAdSlot="4564542487" 
                dataAdFormat="auto" 
                dataFullWidthResponsive={true} 
              />
            </div>
          </div>
          
          {/* 두 번째 플로팅 광고 (쿠팡 파트너스 1번) */}
          <div className="w-full bg-slate-900/80 backdrop-blur-lg rounded-2xl border border-slate-700/80 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex justify-center items-center shrink-0">
            <iframe 
              src="https://ads-partners.coupang.com/widgets.html?id=992805&template=carousel&trackingCode=AF2374736&subId=&width=250&height=300" 
              width="250" 
              height="300" 
              frameBorder="0" 
              scrolling="no" 
              referrerPolicy="unsafe-url"
              className="rounded-lg bg-white shrink-0"
            ></iframe>
          </div>

          {/* 세 번째 플로팅 광고 (쿠팡 파트너스 2번 - 신규) */}
          <div className="w-full bg-slate-900/80 backdrop-blur-lg rounded-2xl border border-slate-700/80 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex justify-center items-center shrink-0">
            <iframe 
              src="https://ads-partners.coupang.com/widgets.html?id=992806&template=carousel&trackingCode=AF2374736&subId=&width=250&height=300" 
              width="250" 
              height="300" 
              frameBorder="0" 
              scrolling="no" 
              referrerPolicy="unsafe-url"
              className="rounded-lg bg-white shrink-0"
            ></iframe>
          </div>
        </div>
      </div>

      {/* 모바일 하단 코스 디테일 바텀 시트 */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{ y: sheetY }}
            onTouchStart={(e) => {
              (window as any).sheetStartY = e.touches[0].clientY;
              (window as any).sheetIsAtTop = scrollRef.current ? scrollRef.current.scrollTop <= 0 : true;
              (window as any).isDraggingSheet = false;
            }}
            onTouchMove={(e) => {
              const startY = (window as any).sheetStartY;
              if (!startY) return;
              const deltaY = e.touches[0].clientY - startY;

              if ((window as any).sheetIsAtTop && deltaY > 0) {
                (window as any).isDraggingSheet = true;
                sheetY.set(deltaY);
              }
            }}
            onTouchEnd={() => {
              const startY = (window as any).sheetStartY;
              if (!startY) return;
              
              if ((window as any).isDraggingSheet) {
                if (sheetY.get() > 100) {
                  closeCourse();
                } else {
                  animate(sheetY, 0, { type: "spring", damping: 25, stiffness: 200 });
                }
              }
              (window as any).sheetStartY = null;
              (window as any).isDraggingSheet = false;
            }}
            className="md:hidden absolute bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 rounded-t-[32px] p-6 pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30 flex flex-col max-h-[85vh] touch-pan-x touch-pan-y"
          >
            {/* 드래그 손잡이 (Pill) */}
            <div className="w-full flex justify-center pb-4 pt-2 cursor-grab shrink-0">
              <div className="w-16 h-1.5 bg-slate-600 rounded-full"></div>
            </div>
            
            <div ref={scrollRef} className="overflow-y-auto custom-scrollbar flex-1 pb-4">
              {renderCourseDetails(false)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
