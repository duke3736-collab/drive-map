"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";

interface Course {
  id: number;
  title: string;
  description: string;
  theme: string;
  tags: string;
  distance: string;
  duration: string;
  waypoints: string;
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

  const [mapLoaded, setMapLoaded] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTheme, setActiveTheme] = useState<string>("all");

  const themes = [
    { id: "all", icon: "🌌", label: "전체보기" },
    { id: "night", icon: "🌃", label: "야경 드라이브" },
    { id: "coastal", icon: "🌊", label: "해안도로" },
    { id: "nature", icon: "🌲", label: "숲속/계곡" },
    { id: "date", icon: "☕", label: "카페/데이트" },
  ];

  // 구글 시트 데이터 로드
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch(GOOGLE_SHEET_URL);
        const data = await res.json();
        // 헤더 행이 들어올 수도 있으므로 id가 있는 것만 필터링
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
        // 초기 서울 중심 좌표
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 10,
      };
      const map = new window.kakao.maps.Map(mapContainerRef.current, options);
      mapRef.current = map;
      setMapLoaded(true);
    });
  };

  // 폴백
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

  // waypoints 문자열 파싱 (이름,위도,경도|이름,위도,경도)
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

  // 코스 그리기
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || courses.length === 0) return;

    // 기존 선, 마커 초기화
    polylinesRef.current.forEach(p => p.setMap(null));
    markersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current = [];
    markersRef.current = [];

    const filteredCourses = activeTheme === 'all' 
      ? courses 
      : courses.filter(c => c.theme === activeTheme);

    filteredCourses.forEach(course => {
      const waypoints = parseWaypoints(course.waypoints);
      if (waypoints.length < 2) return;

      const path = waypoints.map(wp => new window.kakao.maps.LatLng(wp.lat, wp.lng));
      
      // 코스 선 그리기 (Polyline)
      const isSelected = selectedCourse?.id === course.id;
      const polyline = new window.kakao.maps.Polyline({
        path: path,
        strokeWeight: isSelected ? 8 : 5,
        strokeColor: isSelected ? '#3B82F6' : '#94A3B8', // 선택되면 파란색, 아니면 회색
        strokeOpacity: isSelected ? 1 : 0.6,
        strokeStyle: 'solid'
      });
      polyline.setMap(mapRef.current);
      polylinesRef.current.push(polyline);

      // 선 클릭 이벤트
      window.kakao.maps.event.addListener(polyline, 'click', () => {
        handleCourseClick(course, waypoints);
      });

      // 마커(시작점, 도착점) 커스텀 오버레이
      [waypoints[0], waypoints[waypoints.length - 1]].forEach((wp, idx) => {
        const isStart = idx === 0;
        const contentNode = document.createElement('div');
        contentNode.innerHTML = `
          <div class="relative flex flex-col items-center cursor-pointer transition-transform hover:scale-110 z-10 ${isSelected ? 'scale-110 z-20' : ''}">
            <div class="bg-slate-900 border-2 ${isStart ? 'border-indigo-400' : 'border-rose-400'} text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg mb-1 whitespace-nowrap">
              ${wp.name}
            </div>
            <div class="w-4 h-4 rounded-full ${isStart ? 'bg-indigo-500' : 'bg-rose-500'} border-2 border-white shadow-md"></div>
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
    });

  }, [courses, mapLoaded, activeTheme, selectedCourse]);

  const handleCourseClick = (course: Course, waypoints: ParsedWaypoint[]) => {
    setSelectedCourse(course);
    
    // 지도 중심 이동 및 확대
    if (mapRef.current && waypoints.length > 0) {
      // 대략적인 중간 지점으로 이동
      const midIdx = Math.floor(waypoints.length / 2);
      const moveLatLon = new window.kakao.maps.LatLng(waypoints[midIdx].lat, waypoints[midIdx].lng);
      mapRef.current.panTo(moveLatLon);
    }
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col relative bg-slate-950">
      <Script 
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`}
        strategy="afterInteractive"
        onLoad={initMap}
      />

      {/* 헤더 및 테마 필터 (지도 위에 둥둥 떠있게) */}
      <div className="absolute top-0 left-0 w-full z-10 p-4 bg-gradient-to-b from-slate-950/80 to-transparent">
        <h1 className="text-xl font-black text-white mb-3 tracking-tight flex items-center gap-2">
          <span>🚗</span> Drive Map
        </h1>
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
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
      </div>

      {/* 카카오맵 영역 */}
      <div className="flex-1 w-full relative bg-slate-900">
        {(!mapLoaded || isLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
            <span className="text-4xl animate-spin mb-4">🌀</span>
            <p className="text-slate-300 font-bold">
              {isLoading ? "코스 데이터를 불러오는 중..." : "지도를 불러오는 중..."}
            </p>
            {/* 테스트용 임시 문구 (나중에 삭제 가능) */}
            {isLoading && <p className="text-slate-500 text-xs mt-2 text-center px-4">대표님이 방금 만든 구글 시트에서<br/>실시간으로 데이터를 가져오고 있습니다!</p>}
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full"></div>
      </div>

      {/* Bottom Sheet (코스 선택 시 슬라이드업) */}
      <div className={`absolute bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-out z-30 ${selectedCourse ? 'translate-y-0' : 'translate-y-[120%]'}`}>
        
        {/* 닫기 손잡이 */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6 cursor-pointer" onClick={() => setSelectedCourse(null)}></div>

        {selectedCourse && (
          <div className="space-y-4">
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
            
            <p className="text-slate-400 text-sm leading-relaxed">
              {selectedCourse.description}
            </p>
            
            <div className="flex gap-4 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">총 거리</span>
                <span className="font-bold text-slate-200">{selectedCourse.distance}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">예상 시간</span>
                <span className="font-bold text-slate-200">{selectedCourse.duration}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button className="w-full bg-[#000000] border border-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <img src="https://tmapapi.sktelecom.com/main/style/images/top/logo.png" alt="tmap" className="h-4 brightness-200 invert" />
                안내 시작
              </button>
              <button className="w-full bg-[#FEE500] hover:bg-[#F4DC00] text-[#191919] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                카카오내비
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
