"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { BottomSheet } from 'react-spring-bottom-sheet';
import 'react-spring-bottom-sheet/dist/style.css';
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
  _distanceToUser?: number;
}

interface ParsedWaypoint {
  name: string;
  lat: number;
  lng: number;
}

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

declare global {
  interface Window {
    kakao: any;
    __pathsLoaded?: boolean;
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

  // 모바일 여부 체크 (PC에서 BottomSheet 마운트 해제용)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // 초기 체크
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTheme, setActiveTheme] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSplash, setShowSplash] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  // 문의하기 모달 상태
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryType, setInquiryType] = useState('코스 제안/오류 수정');
  const [inquiryContent, setInquiryContent] = useState('');
  const [inquiryContact, setInquiryContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 즐겨찾기 상태 (localStorage 연동)
  const [favorites, setFavorites] = useState<number[]>([]);
  // 위치 기반 정렬 상태
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSortedByDistance, setIsSortedByDistance] = useState(false);

  // 초기 렌더링 시 localStorage에서 찜 목록 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem('driveMapFavorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const toggleFavorite = (courseId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavorites(prev => {
      const isFav = prev.includes(courseId);
      const newFavs = isFav ? prev.filter(id => id !== courseId) : [...prev, courseId];
      localStorage.setItem('driveMapFavorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // 지구의 반지름 (km)
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // 단위: km
  };

  const handleSortByDistance = () => {
    if (isSortedByDistance) {
      setIsSortedByDistance(false);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsSortedByDistance(true);
          setSelectedCourse(null); // 목록 보기 위해 선택 해제
        },
        (error) => {
          console.error(error);
          alert("위치 권한을 허용해주시면 가장 가까운 코스를 찾아드립니다!");
        }
      );
    } else {
      alert("이 브라우저에서는 위치 기능을 지원하지 않습니다.");
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryContent.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      // 대표님이 직접 생성하신 실제 구글 앱스 스크립트 웹앱 URL 연동 완료!
      const scriptUrl = process.env.NEXT_PUBLIC_INQUIRY_API_URL || "https://script.google.com/macros/s/AKfycbx6rYLlow4_IARR7ry9q863mVm3d4Fl-Eswhkx41geL1CwYoJiU6gvA737ZYmvg-jUw/exec";
      
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          type: inquiryType,
          contact: inquiryContact,
          content: inquiryContent,
          timestamp: new Date().toISOString()
        })
      });
      
      alert("성공적으로 전송되었습니다! 소중한 의견 감사합니다.");
      setIsInquiryModalOpen(false);
      setInquiryContent('');
      setInquiryContact('');
    } catch (error) {
      alert("전송에 실패했습니다. 관리자에게 이메일로 직접 문의해주세요.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
  let filteredCourses = courses.filter(c => {
    if (activeTheme === 'favorites') {
      if (!favorites.includes(c.id)) return false;
    } else if (activeTheme !== 'all' && c.theme !== activeTheme) {
      return false;
    }

    if (searchQuery.trim() !== '') {
      let q = searchQuery.toLowerCase().trim();
      
      // 지역명 검색어 유연화 (예: '제주도' -> '제주', '강원도' -> '강원')
      const aliases: Record<string, string> = {
        '제주도': '제주', '강원도': '강원', '경기도': '경기', '충청도': '충청',
        '전라도': '전라', '경상도': '경상', '서울특별시': '서울', '서울시': '서울',
        '부산광역시': '부산', '부산시': '부산', '대구광역시': '대구', '대구시': '대구',
        '인천광역시': '인천', '인천시': '인천', '광주광역시': '광주', '광주시': '광주',
        '대전광역시': '대전', '대전시': '대전', '울산광역시': '울산', '울산시': '울산'
      };
      
      if (aliases[q]) q = aliases[q];

      if (
        !c.title.toLowerCase().includes(q) && 
        !c.description.toLowerCase().includes(q) && 
        !c.tags.toLowerCase().includes(q) &&
        !(c.waypoints && c.waypoints.toLowerCase().includes(q))
      ) {
        return false;
      }
    }
    return true;
  });

  // 거리순 정렬 로직 적용
  if (isSortedByDistance && userLocation) {
    filteredCourses = filteredCourses.map(course => {
      const wp = parseWaypoints(course.waypoints);
      const dist = wp.length > 0 ? calculateDistance(userLocation.lat, userLocation.lng, wp[0].lat, wp[0].lng) : 999999;
      return { ...course, _distanceToUser: dist };
    }).sort((a, b) => (a._distanceToUser || 0) - (b._distanceToUser || 0));
  }

  const themes = [
    { id: "favorites", icon: "❤️", label: "내 찜목록" },
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
      
      // 지도 드래그(이동) 시작 시 상단 메뉴 자동으로 숨기기
      window.kakao.maps.event.addListener(map, 'dragstart', () => {
        setIsHeaderVisible(false);
      });
      
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

  // 코스 그리기 (도로망 연동 반영)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || courses.length === 0) return;

    // 기존 리셋
    polylinesRef.current.forEach(p => p.setMap(null));
    markersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current = [];
    markersRef.current = [];

    const fetchRoutesSequentially = async () => {
      // 0. 프리페칭된 정적 캐시(precalculated_paths.json) 로드
      if (!window.__pathsLoaded) {
        try {
          const res = await fetch('/precalculated_paths.json');
          if (res.ok) {
            const data = await res.json();
            Object.keys(data).forEach(id => {
              const { path, distance, duration } = data[id];
              const latLngPath = path.map((p: any) => new window.kakao.maps.LatLng(p.lat, p.lng));
              cachedPathsRef.current[Number(id)] = { path: latLngPath, distance, duration };
            });
            window.__pathsLoaded = true;
            console.log("Precalculated paths loaded successfully, API calls will be skipped!");
          }
        } catch (e) {
          console.warn("Could not load precalculated paths", e);
        }
      }

      for (const course of filteredCourses) {
        const waypoints = parseWaypoints(course.waypoints);
        if (waypoints.length < 2) continue;
        
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
          
          // 모바일 기기에서 메인 스레드(UI) 프리징을 막고 부드러운 순차 렌더링(폭포수 효과)을 위해 아주 짧은 휴식(yield) 부여
          await new Promise(resolve => setTimeout(resolve, 15));
        } else {
          // 카카오 API 속도 제한(Rate Limit)을 피하기 위해 딜레이 추가
          await new Promise(resolve => setTimeout(resolve, 200));

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

              // 데이터 오류(산꼭대기 등 차량 불가 지역)로 인해 전국을 우회하는 200km 이상 비정상 경로 방어
              const testPolyline = new window.kakao.maps.Polyline({ 
                path: waypoints.map((wp: any) => new window.kakao.maps.LatLng(wp.lat, wp.lng)) 
              });
              const straightDist = testPolyline.getLength();
              if (realDistance && realDistance > straightDist * 5) {
                console.warn("Unreasonable route distance detected, falling back to straight line.");
                throw new Error("Unreasonable route distance");
              }

              const sections = route.sections;
              sections.forEach((section: any) => {
                section.roads.forEach((road: any) => {
                  for (let i = 0; i < road.vertexes.length; i += 2) {
                    const lng = road.vertexes[i];
                    const lat = road.vertexes[i+1];
                    pathCoordinates.push(new window.kakao.maps.LatLng(lat, lng));
                  }
                });
              });
            } else {
              // 실패 시 직선 폴백 및 가상 거리/시간 계산
              pathCoordinates = waypoints.map((wp: any) => new window.kakao.maps.LatLng(wp.lat, wp.lng));
              const polyline = new window.kakao.maps.Polyline({ path: pathCoordinates });
              const straightDist = polyline.getLength(); // 미터 단위
              realDistance = straightDist * 1.3; // 직선거리의 1.3배를 실제 도로 거리로 보정 추정
              realDuration = (realDistance / 40000) * 3600; // 평균 시속 40km 기준으로 초 단위 시간 추정
            }

            cachedPathsRef.current[course.id] = { path: pathCoordinates, distance: realDistance, duration: realDuration };
            drawPolyline(course, pathCoordinates, waypoints, isSelected);

          } catch (e) {
            console.error("Directions API failed, using fallback", e);
            pathCoordinates = waypoints.map((wp: any) => new window.kakao.maps.LatLng(wp.lat, wp.lng));
            const polyline = new window.kakao.maps.Polyline({ path: pathCoordinates });
            const straightDist = polyline.getLength();
            const fallbackDistance = straightDist * 1.3;
            const fallbackDuration = (fallbackDistance / 40000) * 3600;
            
            cachedPathsRef.current[course.id] = { path: pathCoordinates, distance: fallbackDistance, duration: fallbackDuration };
            drawPolyline(course, pathCoordinates, waypoints, isSelected);
          }
        }
      }
    };

    fetchRoutesSequentially();

  }, [courses, mapLoaded, activeTheme, selectedCourse, searchQuery, isSortedByDistance, favorites]);

  // 검색어 입력 시, 검색된 코스들이 모두 화면에 들어오도록 지도 이동 (자동 줌/패닝)
  useEffect(() => {
    if (mapLoaded && mapRef.current && searchQuery.trim() !== '' && filteredCourses.length > 0 && !selectedCourse) {
      const bounds = new window.kakao.maps.LatLngBounds();
      let hasValidCoords = false;
      filteredCourses.forEach(course => {
        const wps = parseWaypoints(course.waypoints);
        if (wps.length > 0) {
          bounds.extend(new window.kakao.maps.LatLng(wps[0].lat, wps[0].lng));
          hasValidCoords = true;
        }
      });
      
      if (hasValidCoords) {
        if (filteredCourses.length === 1) {
           const wps = parseWaypoints(filteredCourses[0].waypoints);
           mapRef.current.setCenter(new window.kakao.maps.LatLng(wps[0].lat, wps[0].lng));
           mapRef.current.setLevel(7);
        } else {
           // 좌측 사이드바(PC) 영역을 피해 마커들이 잘 보이도록 여백(padding) 조정
           const paddingLeft = window.innerWidth > 768 ? 450 : 50;
           mapRef.current.setBounds(bounds, 50, 50, 50, paddingLeft);
        }
      }
    }
  }, [searchQuery, filteredCourses, mapLoaded, selectedCourse]);

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
        {/* 뒤로가기 버튼 */}
        <button 
          onClick={() => setSelectedCourse(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 font-bold w-fit bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50"
        >
          <span>←</span> <span>목록으로 돌아가기</span>
        </button>

        {/* 코스 풍경 사진 (이미지 URL이 있을 경우에만 렌더링) */}
        {selectedCourse.imageUrl && (
          <div 
            className="w-full h-32 md:h-48 bg-slate-800 rounded-2xl bg-cover bg-center shadow-inner mb-4 border border-slate-700"
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
        
        <div className="flex justify-between items-start gap-2">
          <h2 className="text-2xl font-black text-white leading-tight flex-1">
            {selectedCourse.title}
          </h2>
          <button 
            onClick={(e) => toggleFavorite(selectedCourse.id, e)}
            className="text-2xl hover:scale-110 active:scale-95 transition-transform p-1"
            title={favorites.includes(selectedCourse.id) ? "찜 해제" : "찜하기"}
          >
            {favorites.includes(selectedCourse.id) ? '❤️' : '🤍'}
          </button>
        </div>
        
        <p className="text-slate-300 text-sm leading-relaxed">
          {selectedCourse.description}
        </p>
        
        <div className="flex gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">총 거리</span>
            <span className="font-bold text-slate-100">
              {(() => {
                const cached = cachedPathsRef.current[selectedCourse.id];
                if (cached?.distance) return `${(cached.distance / 1000).toFixed(1)}km`;
                if (selectedCourse.distance) return selectedCourse.distance;
                
                const wps = parseWaypoints(selectedCourse.waypoints);
                if (wps.length < 2) return "계산중";
                let straightDist = 0;
                for(let i=0; i<wps.length-1; i++) {
                  const p1 = new window.kakao.maps.LatLng(wps[i].lat, wps[i].lng);
                  const p2 = new window.kakao.maps.LatLng(wps[i+1].lat, wps[i+1].lng);
                  const poly = new window.kakao.maps.Polyline({ path: [p1, p2] });
                  straightDist += poly.getLength();
                }
                const dist = straightDist * 1.3;
                return `약 ${(dist / 1000).toFixed(1)}km`;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">예상 시간</span>
            <span className="font-bold text-slate-100">
              {(() => {
                const cached = cachedPathsRef.current[selectedCourse.id];
                if (cached?.duration) return `${Math.ceil(cached.duration / 60)}분`;
                if (selectedCourse.duration) return selectedCourse.duration;
                
                const wps = parseWaypoints(selectedCourse.waypoints);
                if (wps.length < 2) return "계산중";
                let straightDist = 0;
                for(let i=0; i<wps.length-1; i++) {
                  const p1 = new window.kakao.maps.LatLng(wps[i].lat, wps[i].lng);
                  const p2 = new window.kakao.maps.LatLng(wps[i+1].lat, wps[i+1].lng);
                  const poly = new window.kakao.maps.Polyline({ path: [p1, p2] });
                  straightDist += poly.getLength();
                }
                const dist = straightDist * 1.3;
                const dur = (dist / 40000) * 3600;
                return `약 ${Math.ceil(dur / 60)}분`;
              })()}
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
    <div className="fixed inset-0 w-full flex flex-col md:flex-row bg-slate-950 overflow-hidden" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 이니셜 D 감성의 메인 스플래시 화면 */}
      {showSplash && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-70 scale-105"
            style={{ backgroundImage: "url('/images/hero.png')" }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
          
          <div className="relative z-[999] text-center px-6 mt-32 pointer-events-auto">
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
              className="relative z-[1000] cursor-pointer bg-white text-slate-900 font-black text-xl px-12 py-5 rounded-full shadow-2xl hover:scale-105 hover:bg-slate-100 transition-all border-4 border-slate-200"
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
            className="w-full bg-slate-800/80 border border-slate-700 text-white pl-4 pr-10 py-3 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 shadow-inner"
          />
          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                closeCourse();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white bg-slate-700/80 hover:bg-slate-600 rounded-full w-6 h-6 flex items-center justify-center transition-colors text-[10px] font-black"
              aria-label="검색어 지우기"
            >
              ✕
            </button>
          ) : (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
          )}

          <div className="flex justify-end mt-2 px-1">
            <button 
              onClick={handleSortByDistance}
              className={`text-xs font-bold px-4 py-2 rounded-full transition-all border shadow-sm flex items-center gap-1 ${
                isSortedByDistance 
                  ? 'bg-red-500 text-white border-red-400 shadow-red-500/30' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              📍 {isSortedByDistance ? '내 주변순 정렬 해제' : '내 주변순 정렬'}
            </button>
          </div>

          {/* 검색결과 자동완성 드롭다운 (모바일 전용) */}
          <AnimatePresence>
            {(searchQuery || isSortedByDistance || activeTheme === 'favorites') && !selectedCourse && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 max-h-72 overflow-y-auto custom-scrollbar md:hidden"
              >
                {filteredCourses.length > 0 ? (
                  <div className="p-2 space-y-1">
                    <p className="text-xs text-indigo-400 font-bold px-2 pt-2 pb-1">총 {filteredCourses.length}개의 코스 발견!</p>
                    {filteredCourses.map(course => (
                      <button
                        key={course.id}
                        onClick={() => {
                           setSelectedCourse(course);
                        }}
                        className="w-full text-left p-2 hover:bg-slate-700 rounded-xl transition-colors flex gap-3 items-center active:scale-[0.98]"
                      >
                        {course.imageUrl ? (
                          <div className="w-12 h-12 rounded-lg bg-slate-700 bg-cover bg-center shrink-0 border border-slate-600" style={{ backgroundImage: `url("${course.imageUrl}")` }}></div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-700 shrink-0 flex items-center justify-center text-xl border border-slate-600">🚗</div>
                        )}
                        <div className="flex-1 overflow-hidden pr-2">
                          <div className="text-sm font-bold text-white truncate flex items-center gap-1">
                            {favorites.includes(course.id) && <span className="text-[10px]">❤️</span>}
                            {course.title}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{course.description}</div>
                          {course._distanceToUser !== undefined && (
                            <div className="text-[10px] text-red-400 font-bold mt-0.5">
                              현재 위치에서 약 {course._distanceToUser.toFixed(1)}km
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={(e) => toggleFavorite(course.id, e)}
                          className="p-2 text-lg hover:scale-110 active:scale-95 transition-transform"
                        >
                          {favorites.includes(course.id) ? '❤️' : '🤍'}
                        </button>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-sm font-bold">
                    검색 결과가 없습니다 🥲
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 사이드 메뉴 플로팅 버튼 (헤더가 숨겨졌을 때만 우측에 나타남) */}
        <AnimatePresence>
          {!selectedCourse && !isHeaderVisible && (
            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={() => setIsHeaderVisible(true)}
              className="absolute bottom-8 right-4 z-20 bg-indigo-600/95 backdrop-blur-md text-white px-5 py-3.5 rounded-full shadow-[0_4px_20px_rgba(79,70,229,0.4)] border border-indigo-500 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <span className="text-lg font-black leading-none">☰</span>
              <span className="text-sm font-bold tracking-tight">테마 코스</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 선택된 코스가 없을 때만 헤더 요소들(배너, 테마필터)을 보여줍니다 */}
        <AnimatePresence initial={false}>
          {!selectedCourse && isHeaderVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 0 }}
              exit={{ height: 0, opacity: 0, marginTop: -16 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden w-full flex flex-col shrink-0 relative"
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

              {/* 헤더 하단 닫기(접기) 버튼 - 아주 크고 눈에 띄게 배치 */}
              <div className="w-full flex justify-center pb-2 mb-2">
                <button 
                  onClick={() => setIsHeaderVisible(false)}
                  className="bg-slate-800/90 backdrop-blur-md text-sm text-slate-300 font-bold px-6 py-2.5 rounded-full border border-slate-700 shadow-md flex items-center gap-2 active:scale-95 transition-all hover:bg-slate-700 hover:text-white"
                >
                  메뉴 접어두기 🔼
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PC 전용: 사이드바 코스 디테일 및 광고 영역 */}
        <div className="hidden md:flex flex-col flex-1 overflow-y-auto mt-6 pr-2 custom-scrollbar relative">
          <div className="flex-1 pb-4">
            {selectedCourse ? (
              renderCourseDetails(true)
            ) : filteredCourses.length > 0 && (searchQuery || activeTheme !== 'all' || isSortedByDistance) ? (
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
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-white font-bold group-hover:text-indigo-400 transition-colors flex-1 pr-2">
                        {favorites.includes(course.id) && <span className="text-xs mr-1">❤️</span>}
                        {course.title}
                      </h3>
                      <button 
                        onClick={(e) => toggleFavorite(course.id, e)}
                        className="text-lg hover:scale-110 active:scale-95 transition-transform p-1 -mt-1 -mr-1"
                      >
                        {favorites.includes(course.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                    <p className="text-slate-300 text-xs line-clamp-2 mb-2">{course.description}</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-indigo-400 font-bold">{course.distance}</span>
                      <span className="text-xs text-slate-400">{course.duration}</span>
                      {course._distanceToUser !== undefined && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-sm font-bold border border-red-500/30">
                          약 {course._distanceToUser.toFixed(1)}km
                        </span>
                      )}
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
        <div id="map" ref={mapContainerRef} className="w-full h-full bg-slate-900"></div>

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
          
          {/* 두 번째 커스텀 배너 (쿠팡 파트너스 자동차용품 수동 배너) */}
          <a
            href="https://link.coupang.com/a/d9aFVtygcC" 
            target="_blank"
            rel="noopener noreferrer" 
            className="group relative w-full h-[250px] bg-slate-900/80 backdrop-blur-lg rounded-2xl border border-slate-700/80 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-end shrink-0 transition-all hover:-translate-y-1 hover:shadow-sky-500/20"
          >
            {/* 자동차용품 배경 이미지 (어둡게 처리) */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1601362840469-51e4d8d58785?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent"></div>
            
            <div className="relative z-10 flex flex-col gap-1.5">
              <span className="bg-sky-500 text-white text-[10px] font-black px-2 py-1 rounded w-fit tracking-wider shadow-lg">CAR ACCESSORIES</span>
              <h3 className="text-white font-black text-xl leading-tight mt-1 group-hover:text-sky-100 transition-colors drop-shadow-md">
                드라이브 필수템 총집합!<br/>차량용품 로켓배송
              </h3>
              <p className="text-slate-300 text-xs font-medium mt-1 flex items-center gap-1">
                쿠팡 자동차용품 기획전 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </p>
            </div>
          </a>

          {/* 세 번째 커스텀 배너 (쿠팡 파트너스 호텔/여행 수동 배너) */}
          <a
            href="https://link.coupang.com/a/d9adnYXKtE" 
            target="_blank"
            rel="noopener noreferrer" 
            className="group relative w-full h-[250px] bg-slate-900/80 backdrop-blur-lg rounded-2xl border border-slate-700/80 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-end shrink-0 transition-all hover:-translate-y-1 hover:shadow-rose-500/20"
          >
            {/* 호캉스 배경 이미지 (어둡게 처리) */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent"></div>
            
            <div className="relative z-10 flex flex-col gap-1.5">
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded w-fit tracking-wider shadow-lg">HOTEL & RESORT</span>
              <h3 className="text-white font-black text-xl leading-tight mt-1 group-hover:text-rose-100 transition-colors drop-shadow-md">
                드라이브 후 꿀맛 휴식!<br/>전국 호캉스 특가 예약
              </h3>
              <p className="text-slate-300 text-xs font-medium mt-1 flex items-center gap-1">
                쿠팡 트래블 특가 보러가기 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </p>
            </div>
          </a>
          
          {/* 쿠팡 파트너스 대가성 문구 (법적 의무) */}
          <div className="w-full text-center py-3 px-3 bg-slate-900/60 backdrop-blur-lg rounded-xl border border-slate-700/50 shrink-0 mt-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br/>이에 따른 일정액의 수수료를 제공받습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 모바일 하단 코스 디테일 바텀 시트 (100% 네이티브 느낌) */}
      {isMobile && (
        <BottomSheet
          open={!!selectedCourse}
          onDismiss={closeCourse}
          snapPoints={({ maxHeight }) => [maxHeight * 0.85, maxHeight * 0.5]}
          defaultSnap={({ maxHeight }) => maxHeight * 0.5}
          className="drive-map-bottom-sheet"
        >
          <div className="p-6 pt-0 pb-12">
            {selectedCourse && renderCourseDetails(false)}
          </div>
        </BottomSheet>
      )}

      {/* 좌측 하단 제안 및 문의 플로팅 버튼 */}
      <button
        onClick={() => setIsInquiryModalOpen(true)}
        className="fixed bottom-6 left-6 z-50 bg-slate-800/90 backdrop-blur-md text-slate-300 hover:text-white px-4 py-3 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-slate-700 flex items-center justify-center gap-2 transition-all hover:-translate-y-1 hover:shadow-indigo-500/20 active:scale-95 group"
      >
        <span className="text-xl group-hover:animate-bounce">💡</span>
        <span className="text-sm font-bold tracking-tight">제안 및 문의</span>
      </button>

      {/* 문의하기 팝업 모달 */}
      <AnimatePresence>
        {isInquiryModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsInquiryModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
              
              <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
                <span className="text-indigo-400">💬</span> 제안 및 문의하기
              </h2>
              <p className="text-sm text-slate-400 mb-6">코스 추가, 정보 수정, 광고/제휴 등 무엇이든 편하게 남겨주세요.</p>

              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">문의 유형</label>
                  <div className="flex gap-2">
                    {['코스 제안/오류 수정', '광고/제휴 제안'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setInquiryType(type)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                          inquiryType === type 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">연락처 / 이메일 <span className="text-slate-500 font-normal">(선택)</span></label>
                  <input
                    type="text"
                    value={inquiryContact}
                    onChange={e => setInquiryContact(e.target.value)}
                    placeholder="답변을 원하실 경우 남겨주세요"
                    className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">문의 내용</label>
                  <textarea
                    required
                    value={inquiryContent}
                    onChange={e => setInquiryContent(e.target.value)}
                    placeholder="어떤 점을 개선하면 좋을까요?"
                    className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl h-32 resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 custom-scrollbar"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !inquiryContent.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-lg py-4 rounded-xl shadow-[0_4px_20px_rgba(79,70,229,0.4)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.6)] hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {isSubmitting ? '전송 중...' : '의견 보내기 🚀'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
