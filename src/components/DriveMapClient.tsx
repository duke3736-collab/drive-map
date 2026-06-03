"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
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

const parseWaypoints = (str: any): ParsedWaypoint[] => {
  if (typeof str !== 'string' || !str) return [];
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
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyQ-vhk6Kj6uIFyxugwoHC19OU8XIPRzNc8AbMWbJ3AVoCcGjNZBuc_QVMcAsy9qFOwkA/exec";

const REGION_KEYWORDS: Record<string, string[]> = {
  'seoul': ['서울', '인천', '경기', '파주', '남양주', '가평', '양평', '일산', '강화', '포천', '수원', '용인'],
  'gangwon': ['강원', '강릉', '속초', '동해시', '삼척', '평창', '양양', '고성군', '춘천', '원주'],
  'chungcheong': ['충청', '대전', '세종', '천안', '보령', '당진', '태안', '제천', '단양', '공주'],
  'jeolla': ['전라', '광주', '전주', '군산', '목포', '여수', '순천', '담양', '고창', '부안'],
  'gyeongsang': ['경상', '대구', '부산', '울산', '경주', '포항', '통영', '거제', '남해군', '창원'],
  'jeju': ['제주', '서귀포', '애월', '중문']
};

const REGION_MAP_VIEWS: Record<string, { lat: number, lng: number, level: number }> = {
  'seoul': { lat: 37.5665, lng: 126.9780, level: 10 },
  'gangwon': { lat: 37.7518, lng: 128.8760, level: 10 },
  'chungcheong': { lat: 36.5184, lng: 127.2000, level: 10 },
  'jeolla': { lat: 35.1595, lng: 126.8526, level: 10 },
  'gyeongsang': { lat: 35.5383, lng: 129.3113, level: 10 },
  'jeju': { lat: 33.3833, lng: 126.5500, level: 9 }
};

const EDITOR_PICKS = [1, 2, 3, 4, 7, 16, 17, 21, 25, 8];

const CURATION_CATEGORIES = [
  { id: 'spring', icon: '🌸', name: '봄꽃 드라이브', keywords: ['벚꽃', '봄꽃', '꽃놀이', '개나리', '유채꽃', '봄바람'] },
  { id: 'beginner', icon: '🚗', name: '초보운전 안심', keywords: ['직진', '방조제', '초보', '초보운전', '시화방조제', '새만금', '주차장', '넓은'] },
  { id: 'romantic', icon: '👩‍❤️‍👨', name: '로맨틱 노을 데이트', keywords: ['노을', '노을맛집', '낙조', '데이트', '야경', '연인', '드라이브코스추천'] },
  { id: 'alone', icon: '🎧', name: '혼자 떠나는 사색', keywords: ['사색', '한적한', '조용한', '옛길', '오지', '숲멍', '물멍', '힐링', '혼자'] }
];

const REGIONS = [
  { id: 'all', name: '전국' },
  { id: 'seoul', name: '서울/경기' },
  { id: 'gangwon', name: '강원' },
  { id: 'chungcheong', name: '충청/대전' },
  { id: 'jeolla', name: '전라/광주' },
  { id: 'gyeongsang', name: '경상/부산' },
  { id: 'jeju', name: '제주' }
];

export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const myLocationMarkerRef = useRef<any>(null);
  // 이미 서버에서 받아온 도로 좌표 및 실시간 거리/시간 캐싱
  const cachedPathsRef = useRef<Record<number, { path: any[], distance?: number, duration?: number }>>({});
  
  // 주행 모드용 Refs
  const driveMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const skipListTransitionRef = useRef(false);

  const [isMounted, setIsMounted] = useState(false);

  // 모바일 여부 체크 (PC에서 BottomSheet 마운트 해제용)
  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // 초기 체크
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list'); // 모바일 탭 상태
  const [courses, setCourses] = useState<Course[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTheme, setActiveTheme] = useState<string>("all");
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [activeCuration, setActiveCuration] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSplash, setShowSplash] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);

  // 문의하기 모달 상태
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryType, setInquiryType] = useState('코스 제안/오류 수정');
  const [inquiryContent, setInquiryContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 즐겨찾기 상태 (localStorage 연동)
  const [favorites, setFavorites] = useState<number[]>([]);
  // 위치 기반 정렬 상태
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSortedByDistance, setIsSortedByDistance] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isLocatingMap, setIsLocatingMap] = useState(false);

  // 주행 모드 상태
  const [isDriveMode, setIsDriveMode] = useState(false);
  const [showDriveCompleteModal, setShowDriveCompleteModal] = useState(false);
  const [driveLocation, setDriveLocation] = useState<{lat: number, lng: number} | null>(null);

  // 모바일에서 지도 탭 활성화 시 카카오맵 relayout 호출 및 중심 재조정
  useEffect(() => {
    if (isMobile && activeTab === 'map' && mapRef.current && window.kakao && window.kakao.maps) {
      setTimeout(() => {
        if (mapRef.current && window.kakao && window.kakao.maps) {
          mapRef.current.relayout();
          if (selectedCourse) {
            const wps = parseWaypoints(selectedCourse.waypoints);
            if (wps.length > 0) {
              const bounds = new window.kakao.maps.LatLngBounds();
              wps.forEach(wp => bounds.extend(new window.kakao.maps.LatLng(wp.lat, wp.lng)));
              // 모바일 상세 카드(높이 약 40%) 및 헤더 영역을 피해 코스를 화면에 꽉 차고 세밀하게(확대해서) 보여주도록 스마트 패딩 지정
              mapRef.current.setBounds(bounds, 80, 20, 260, 20);
            }
          } else {
            // selectedCourse가 없을 경우, 현재 선택된 지역 필터나 전체 코스에 맞게 지도 중심 설정 (서울 고정 이동 버그 해결)
            if (activeRegion !== 'all' && !searchQuery) {
              const view = REGION_MAP_VIEWS[activeRegion];
              if (view) {
                mapRef.current.setCenter(new window.kakao.maps.LatLng(view.lat, view.lng));
                mapRef.current.setLevel(view.level);
              }
            } else if (filteredCourses.length > 0) {
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
                // 모바일에서 다수의 코스를 오차를 최소화하여 최대한 가깝게 확대 렌더링하도록 좁은 여백 지정
                mapRef.current.setBounds(bounds, 40, 20, 40, 20);
              } else {
                mapRef.current.setCenter(new window.kakao.maps.LatLng(37.5665, 126.9780));
                mapRef.current.setLevel(10);
              }
            } else {
              mapRef.current.setCenter(new window.kakao.maps.LatLng(37.5665, 126.9780));
              mapRef.current.setLevel(10);
            }
          }
        }
      }, 100);
    }
  }, [activeTab, isMobile, selectedCourse, activeRegion, searchQuery]);

  // 지도 탭 진입 시 지도가 아직 로드되지 않은 상태라면 초기화 시도
  useEffect(() => {
    if (activeTab === 'map' && !mapLoaded) {
      if (window.kakao && window.kakao.maps) {
        if (typeof window.kakao.maps.load === 'function') {
          window.kakao.maps.load(() => {
            initMap();
          });
        } else {
          initMap();
        }
      }
    }
  }, [activeTab, mapLoaded]);

  // 초기 렌더링 시 localStorage에서 찜 목록 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem('driveMapFavorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {}
  }, []);

  // 카카오맵 및 카카오 SDK 동적 주입 (Next.js Script 컴포넌트 로딩 누락 문제 극복)
  useEffect(() => {
    const loadKakaoMap = () => {
      if (window.kakao && window.kakao.maps) {
        if (typeof window.kakao.maps.load === 'function') {
          window.kakao.maps.load(() => {
            initMap();
          });
        } else {
          initMap();
        }
        return;
      }

      if (!document.getElementById('kakao-map-script')) {
        const mapScript = document.createElement('script');
        mapScript.id = 'kakao-map-script';
        // autoload=false를 사용하여 비동기 로딩을 올바르게 수행합니다.
        mapScript.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;
        mapScript.async = true;
        mapScript.onload = () => {
          if (window.kakao && window.kakao.maps) {
            window.kakao.maps.load(() => {
              initMap();
            });
          }
        };
        mapScript.onerror = (e) => {
          console.error("Kakao Maps script load error", e);
        };
        document.head.appendChild(mapScript);
      }
    };

    loadKakaoMap();

    if (!document.getElementById('kakao-sdk-script')) {
      const sdkScript = document.createElement('script');
      sdkScript.id = 'kakao-sdk-script';
      sdkScript.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
      sdkScript.async = true;
      sdkScript.onload = () => {
        if (window.Kakao && typeof window.Kakao.isInitialized === 'function') {
          if (!window.Kakao.isInitialized()) {
            window.Kakao.init(KAKAO_APP_KEY);
          }
        }
      };
      document.head.appendChild(sdkScript);
    }
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

  const getCourseStats = (course: Course) => {
    try {
      if (course.distance && course.duration) {
        return { distance: course.distance, duration: course.duration };
      }

      const cached = cachedPathsRef.current[course.id];
      if (cached && cached.distance && cached.duration) {
        return {
          distance: `${(cached.distance / 1000).toFixed(1)}km`,
          duration: `약 ${Math.ceil(cached.duration / 60)}분`
        };
      }

      const wps = parseWaypoints(course.waypoints);
      if (wps.length >= 2) {
        let straightDist = 0;
        for (let i = 0; i < wps.length - 1; i++) {
          straightDist += calculateDistance(wps[i].lat, wps[i].lng, wps[i + 1].lat, wps[i + 1].lng);
        }
        const dist = straightDist * 1.3;
        const dur = (dist / 40) * 60;
        return {
          distance: `약 ${dist.toFixed(1)}km`,
          duration: `약 ${Math.ceil(dur)}분`
        };
      }

      return {
        distance: "계산 중",
        duration: "계산 중"
      };
    } catch (e) {
      console.error("Error in getCourseStats", e);
      return {
        distance: "계산 중",
        duration: "계산 중"
      };
    }
  };

  const handleSortByDistance = () => {
    if (isSortedByDistance) {
      setIsSortedByDistance(false);
      return;
    }

    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsSortedByDistance(true);
          setSelectedCourse(null);
          setIsLocating(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("위치 정보를 가져올 수 없습니다. 권한을 확인해주세요.");
          setIsLocating(false);
        }
      );
    } else {
      alert("이 브라우저에서는 위치 기능을 지원하지 않습니다.");
    }
  };

  const startDriveMode = async () => {
    if (!selectedCourse) return;
    if (!window.kakao || !window.kakao.maps) {
      alert("지도가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    let path = cachedPathsRef.current[selectedCourse.id]?.path;
    if (!path || path.length === 0) {
      const wps = parseWaypoints(selectedCourse.waypoints);
      path = wps.map((wp: any) => new window.kakao.maps.LatLng(wp.lat, wp.lng));
    }
    
    if (!path || path.length < 2) {
      alert("경로 데이터가 부족하여 가상 주행을 시작할 수 없습니다.");
      return;
    }

    setIsDriveMode(true);
    
    // 약 10초(10000ms) 동안 코스 완주 애니메이션 (50ms마다 업데이트 = 총 200 프레임)
    const stepTime = 50;
    const totalSteps = 200;
    let currentStep = 0;
    
    if (watchIdRef.current !== null) {
      clearInterval(watchIdRef.current as any);
    }

    watchIdRef.current = setInterval(() => {
      currentStep++;
      if (currentStep >= totalSteps) {
        stopDriveMode();
        return;
      }
      
      // 전체 경로 중 현재 진행도 계산 (0.0 ~ 1.0)
      const progress = currentStep / totalSteps;
      const exactIndex = progress * (path.length - 1);
      const index1 = Math.floor(exactIndex);
      const index2 = Math.ceil(exactIndex);
      const fraction = exactIndex - index1;
      
      const p1 = path[index1];
      const p2 = path[index2] || p1;
      
      const getLat = (p: any) => typeof p.getLat === 'function' ? p.getLat() : p.lat;
      const getLng = (p: any) => typeof p.getLng === 'function' ? p.getLng() : p.lng;
      
      const lat = getLat(p1) + (getLat(p2) - getLat(p1)) * fraction;
      const lng = getLng(p1) + (getLng(p2) - getLng(p1)) * fraction;
      
      setDriveLocation({ lat, lng });
      
      // 애니메이션 중 자연스러운 패닝
      if (mapRef.current && window.kakao && window.kakao.maps) {
        const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
        mapRef.current.panTo(moveLatLon);
      }
    }, stepTime) as any;
  };

  const stopDriveMode = () => {
    if (watchIdRef.current !== null) {
      clearInterval(watchIdRef.current as any);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    
    if (driveMarkerRef.current) {
      driveMarkerRef.current.setMap(null);
      driveMarkerRef.current = null;
    }
    
    setIsDriveMode(false);
    setDriveLocation(null);
    setShowDriveCompleteModal(true);
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
          content: inquiryContent,
          timestamp: new Date().toISOString()
        })
      });
      
      alert("성공적으로 전송되었습니다! 소중한 의견 감사합니다.");
      setIsInquiryModalOpen(false);
      setInquiryContent('');
    } catch (error) {
      alert("전송에 실패했습니다. 관리자에게 이메일로 직접 문의해주세요.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 뒤로가기 및 닫기 공통 함수들
  const closeCourseAndReturnToList = () => {
    setSelectedCourse(null);
    setIsSheetMinimized(false);
    if (isMobile) {
      setActiveTab('list');
    }
    if (window.location.hash === '#course') {
      window.history.back(); // 해시 제거
    }
  };

  const closeCourseKeepMap = () => {
    skipListTransitionRef.current = true;
    setSelectedCourse(null);
    setIsSheetMinimized(false);
    if (window.location.hash === '#course') {
      window.history.back(); // 해시 제거
    }
  };

  const scrollToCourseList = () => {
    setTimeout(() => {
      const element = document.getElementById("course-list-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  };

  // 모바일에서 선택 코스 활성화 시 지도 갱신(relayout) 및 범위 지정
  useEffect(() => {
    if (mapRef.current && selectedCourse && isMobile && window.kakao && window.kakao.maps) {
      setTimeout(() => {
        if (mapRef.current && window.kakao && window.kakao.maps) {
          mapRef.current.relayout();
          const wps = parseWaypoints(selectedCourse.waypoints);
          if (wps.length > 0) {
            const bounds = new window.kakao.maps.LatLngBounds();
            wps.forEach(wp => bounds.extend(new window.kakao.maps.LatLng(wp.lat, wp.lng)));
            mapRef.current.setBounds(bounds, 80, 80, 50, 50);
          }
        }
      }, 150);
    }
  }, [selectedCourse, isMobile]);

  // 브라우저 뒤로가기 감지 (해시 변경 감지)
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash !== '#course') {
        setSelectedCourse(null);
        if (isMobile) {
          if (skipListTransitionRef.current) {
            skipListTransitionRef.current = false;
          } else {
            setActiveTab('list');
          }
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isMobile]);

  // 코스 선택 시 URL 해시 추가 (히스토리 스택에 쌓기)
  useEffect(() => {
    if (selectedCourse && window.location.hash !== '#course') {
      window.location.hash = 'course';
    }
  }, [selectedCourse]);

  // Derived state for filtering
  let filteredCourses = courses.filter(c => {
    // 1. 에디터 추천 명예의 전당
    if (activeCuration === 'ranking') {
      return EDITOR_PICKS.includes(c.id);
    }
    
    // 2. 상황별 맞춤 큐레이션 (기획전)
    if (activeCuration && activeCuration !== 'ranking') {
      const category = CURATION_CATEGORIES.find(cat => cat.id === activeCuration);
      if (category) {
        const matches = category.keywords.some(kw => 
          (c.title || "").includes(kw) || 
          (c.tags || "").includes(kw) || 
          (c.description || "").includes(kw) || 
          (c.waypoints || "").includes(kw)
        );
        if (!matches) return false;
      }
    }

    if (activeTheme === 'favorites') {
      if (!favorites.includes(c.id)) return false;
    } else if (activeTheme !== 'all' && c.theme !== activeTheme) {
      return false;
    }

    // When distance‑sorted view is active we intentionally ignore regional filters.
    if (!isSortedByDistance && activeRegion !== 'all') {
      const keywords = REGION_KEYWORDS[activeRegion] || [];
      const matchesRegion = keywords.some(kw => 
        (c.title || "").includes(kw) || 
        (c.tags || "").includes(kw) || 
        (c.waypoints || "").includes(kw) || 
        (c.description || "").includes(kw)
      );
      if (!matchesRegion) return false;
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
        !(c.title || "").toLowerCase().includes(q) && 
        !(c.description || "").toLowerCase().includes(q) && 
        !(c.tags || "").toLowerCase().includes(q) &&
        !(c.waypoints || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // 거리순 및 랭킹 정렬 로직 적용
  if (activeCuration === 'ranking') {
    filteredCourses.sort((a, b) => EDITOR_PICKS.indexOf(a.id) - EDITOR_PICKS.indexOf(b.id));
  } else if (isSortedByDistance && userLocation) {
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

  // 구글 시트 데이터 로드 (백엔드 API 경유)
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch("/api/courses");
        const data = await res.json();
        setCourses(data);
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
    if (!mapContainerRef.current) return;

    // 모바일(화면 너비 768px 미만)이고 지도 탭이 아닌 경우(지도 엘리먼트가 hidden 상태)에는 지도를 미리 생성하지 않고 대기합니다.
    if (window.innerWidth < 768 && activeTab !== 'map') return;

    try {
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 10,
      };
      const map = new window.kakao.maps.Map(mapContainerRef.current, options);
      mapRef.current = map;

      // 데스크탑에서는 오른쪽 애드 배너(280px)를 고려하여 중심을 오른쪽으로 140px 이동하여 시각적 정중앙 구현
      if (window.innerWidth > 768) {
        map.panBy(140, 0);
      }
      
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
    } catch (e) {
      console.error("Failed to initialize Kakao Map:", e);
    }
  };

  useEffect(() => {
    if (mapLoaded) return;
    const interval = setInterval(() => {
      if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function') {
        clearInterval(interval);
        window.kakao.maps.load(() => {
          initMap();
        });
      }
    }, 300);
    return () => clearInterval(interval);
  }, [mapLoaded]);

  // 코스 그리기 (도로망 연동 반영)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || courses.length === 0 || !window.kakao || !window.kakao.maps) return;

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

      if (userLocation && isSortedByDistance) {
        const userContent = document.createElement('div');
        userContent.innerHTML = `
          <div class="relative flex flex-col items-center pointer-events-none animate-bounce" style="z-index: 100;">
            <div class="bg-red-600 border-2 border-white text-white text-xs font-black px-3 py-1 rounded-full shadow-lg mb-1 whitespace-nowrap">
              내 위치 📍
            </div>
            <div class="w-6 h-6 rounded-full bg-red-600 border-[3px] border-white shadow-[0_0_15px_rgba(220,38,38,0.8)] flex items-center justify-center">
              <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
        `;
        const userMarker = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
          content: userContent,
          yAnchor: 1
        });
        userMarker.setMap(mapRef.current);
        markersRef.current.push(userMarker);
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
            
            if (naviData.routes && naviData.routes.length > 0 && naviData.routes[0].summary) {
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
              if (sections && Array.isArray(sections)) {
                sections.forEach((section: any) => {
                  if (section.roads && Array.isArray(section.roads)) {
                    section.roads.forEach((road: any) => {
                      if (road.vertexes && Array.isArray(road.vertexes)) {
                        for (let i = 0; i < road.vertexes.length; i += 2) {
                          const lng = road.vertexes[i];
                          const lat = road.vertexes[i+1];
                          pathCoordinates.push(new window.kakao.maps.LatLng(lat, lng));
                        }
                      }
                    });
                  }
                });
              }
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

          } catch (e: any) {
            console.warn("Directions API failed, using fallback:", e.message || e);
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

  }, [courses, mapLoaded, activeTheme, activeRegion, selectedCourse, searchQuery, isSortedByDistance, favorites, userLocation]);

  // 코스 목록이 변경될 때(초기 로드, 검색, 테마 필터 등) 검색된 코스들이 모두 화면에 들어오도록 지도 이동 (자동 줌/패닝)
  useEffect(() => {
    if (mapLoaded && mapRef.current && filteredCourses.length > 0 && !selectedCourse && !isSortedByDistance && window.kakao && window.kakao.maps) {
      if (activeRegion !== 'all' && !searchQuery) {
        // 지역 필터일 경우 지정된 고정 뷰로 이동
        const view = REGION_MAP_VIEWS[activeRegion];
        if (view) {
          mapRef.current.setCenter(new window.kakao.maps.LatLng(view.lat, view.lng));
          mapRef.current.setLevel(view.level);
          if (window.innerWidth > 768) {
            // 데스크탑에서는 오른쪽 애드 배너(280px)를 고려하여 중심을 오른쪽으로 140px 이동하여 시각적 정중앙 구현
            mapRef.current.panBy(140, 0);
          }
        }
      } else {
        // 전체보기, 검색, 테마 필터 등은 기존처럼 바운딩 처리
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
             if (window.innerWidth > 768) {
               mapRef.current.panBy(140, 0);
             }
          } else {
             const isDesktop = window.innerWidth > 768;
             const pTop = isDesktop ? 80 : 40;
             const pRight = isDesktop ? 360 : 20;
             const pBottom = isDesktop ? 80 : 40;
             const pLeft = isDesktop ? 80 : 20;
             mapRef.current.setBounds(bounds, pTop, pRight, pBottom, pLeft);
          }
        }
      }
    }
  }, [searchQuery, activeTheme, activeRegion, mapLoaded, selectedCourse, isSortedByDistance, courses.length]); // courses.length를 추가하여 초기 로딩 완료 시점에 자동 패닝되도록 수정

  // 거리순 정렬 시 내 위치로 자동 패닝
  useEffect(() => {
    if (mapLoaded && mapRef.current && isSortedByDistance && userLocation && window.kakao && window.kakao.maps) {
      const bounds = new window.kakao.maps.LatLngBounds();
      bounds.extend(new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng));
      bounds.extend(new window.kakao.maps.LatLng(userLocation.lat + 0.005, userLocation.lng + 0.005));
      bounds.extend(new window.kakao.maps.LatLng(userLocation.lat - 0.005, userLocation.lng - 0.005));
      
      const isDesktop = window.innerWidth > 768;
      const pTop = isDesktop ? 80 : 40;
      const pRight = isDesktop ? 360 : 20;
      const pBottom = isDesktop ? 80 : 40;
      const pLeft = isDesktop ? 80 : 20;
      mapRef.current.setBounds(bounds, pTop, pRight, pBottom, pLeft);
    }
  }, [isSortedByDistance, userLocation, mapLoaded]);

  // 주행 모드 내 위치 마커 렌더링
  useEffect(() => {
    if (mapLoaded && mapRef.current && isDriveMode && driveLocation && window.kakao && window.kakao.maps) {
      const moveLatLon = new window.kakao.maps.LatLng(driveLocation.lat, driveLocation.lng);
      
      if (!driveMarkerRef.current) {
        const carContent = document.createElement('div');
        carContent.innerHTML = `
          <div class="relative flex flex-col items-center pointer-events-none" style="z-index: 100;">
            <div class="w-12 h-12 bg-white rounded-full border-4 border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.6)] flex items-center justify-center animate-pulse">
              <span class="text-2xl">🚙</span>
            </div>
          </div>
        `;
        const customOverlay = new window.kakao.maps.CustomOverlay({
          position: moveLatLon,
          content: carContent,
          yAnchor: 0.5
        });
        customOverlay.setMap(mapRef.current);
        driveMarkerRef.current = customOverlay;
      } else {
        driveMarkerRef.current.setPosition(moveLatLon);
      }
    }
  }, [driveLocation, isDriveMode, mapLoaded]);

  const drawPolyline = (course: Course, path: any[], waypoints: ParsedWaypoint[], isSelected: boolean) => {
    if (!mapRef.current || !window.kakao || !window.kakao.maps) return;
    
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
    setIsSheetMinimized(false); // 새로운 코스 선택 시 기본적으로 확장 상태로 시작
    if (isMobile) {
      setActiveTab('map');
    }
    
    if (window.kakao && window.kakao.maps && mapRef.current && waypoints.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      waypoints.forEach(wp => bounds.extend(new window.kakao.maps.LatLng(wp.lat, wp.lng)));
      
      const isDesktop = window.innerWidth > 768;
      const pTop = isDesktop ? 100 : 80;
      const pRight = isDesktop ? 360 : 20;
      const pBottom = isDesktop ? 100 : 260;
      const pLeft = isDesktop ? 80 : 20;
      mapRef.current.setBounds(bounds, pTop, pRight, pBottom, pLeft);
    }
  };

  const findMyLocation = () => {
    if (!window.kakao || !window.kakao.maps) {
      alert("지도가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!navigator.geolocation) {
      alert("현재 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }
    setIsLocatingMap(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (window.kakao && window.kakao.maps && mapRef.current) {
        const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
        const bounds = new window.kakao.maps.LatLngBounds();
        bounds.extend(moveLatLon);
        bounds.extend(new window.kakao.maps.LatLng(lat + 0.005, lng + 0.005));
        bounds.extend(new window.kakao.maps.LatLng(lat - 0.005, lng - 0.005));
        
        const isDesktop = window.innerWidth > 768;
        const pTop = isDesktop ? 80 : 40;
        const pRight = isDesktop ? 360 : 20;
        const pBottom = isDesktop ? 80 : 40;
        const pLeft = isDesktop ? 80 : 20;
        mapRef.current.setBounds(bounds, pTop, pRight, pBottom, pLeft);
        
        if (myLocationMarkerRef.current) {
          myLocationMarkerRef.current.setMap(null);
        }
        
        const userContent = document.createElement('div');
        userContent.innerHTML = `
          <div class="relative flex flex-col items-center pointer-events-none animate-bounce" style="z-index: 100;">
            <div class="bg-red-600 border-2 border-white text-white text-xs font-black px-3 py-1 rounded-full shadow-lg mb-1 whitespace-nowrap">
              내 위치 📍
            </div>
            <div class="w-6 h-6 rounded-full bg-red-600 border-[3px] border-white shadow-[0_0_15px_rgba(220,38,38,0.8)] flex items-center justify-center">
              <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
        `;
        const customOverlay = new window.kakao.maps.CustomOverlay({
          position: moveLatLon,
          content: userContent,
          yAnchor: 1
        });
        customOverlay.setMap(mapRef.current);
        myLocationMarkerRef.current = customOverlay;
      }
      setIsLocatingMap(false);
    }, () => {
      alert("위치 정보를 가져올 수 없습니다. 브라우저 설정에서 위치 권한을 허용해주세요!");
      setIsLocatingMap(false);
    });
  };

  const renderCourseDetails = (isDesktop: boolean) => {
    if (!selectedCourse) return null;
    return (
      <div className="space-y-4">
        {/* 뒤로가기 버튼 (데스크톱 전용) */}
        {isDesktop && (
          <button 
            onClick={() => setSelectedCourse(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 font-bold w-fit bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50"
          >
            <span>←</span> <span>목록으로 돌아가기</span>
          </button>
        )}

        {/* 코스 풍경 사진 (데스크톱 전용, 이미지 URL이 있을 경우에만 렌더링) */}
        {isDesktop && selectedCourse.imageUrl && (
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
                  straightDist += calculateDistance(wps[i].lat, wps[i].lng, wps[i+1].lat, wps[i+1].lng);
                }
                const dist = straightDist * 1.3;
                return `약 ${dist.toFixed(1)}km`;
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
                  straightDist += calculateDistance(wps[i].lat, wps[i].lng, wps[i+1].lat, wps[i+1].lng);
                }
                const dist = straightDist * 1.3;
                const dur = (dist / 40) * 60;
                return `약 ${Math.ceil(dur)}분`;
              })()}
            </span>
          </div>
        </div>

        {/* 수익화 배너 영역 (구글 애드센스) - 데스크톱 상세뷰에서 티맵/카카오내비 버튼 위 */}
        {isDesktop && (
          <div className="w-full h-[250px] bg-slate-800/50 rounded-xl overflow-hidden shadow-sm mt-4">
            <AdBanner 
              dataAdSlot="4564542487" 
              dataAdFormat="auto" 
              dataFullWidthResponsive={true} 
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button 
            onClick={() => {
              const wps = parseWaypoints(selectedCourse.waypoints);
              if (wps.length > 0) {
                const dest = wps[wps.length - 1];
                const encodedName = encodeURIComponent(dest.name);
                const kakaoFallbackUrl = `https://map.kakao.com/link/to/${encodedName},${dest.lat},${dest.lng}`;
                
                const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const isRealMobile = isMobileDevice && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
                
                if (isRealMobile) {
                  const tmapUrl = `tmap://route?rGoName=${encodedName}&rGoX=${dest.lng}&rGoY=${dest.lat}`;
                  const start = Date.now();
                  window.location.href = tmapUrl;
                  setTimeout(() => {
                    if (Date.now() - start < 1500) {
                      window.location.href = kakaoFallbackUrl;
                    }
                  }, 1000);
                } else {
                  window.open(kakaoFallbackUrl, '_blank');
                }
              }
            }}
            className="w-full bg-[#111111] border border-slate-600 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <span className="text-lg">🧭</span> 티맵 안내
          </button>
          <button 
            onClick={() => {
              const wps = parseWaypoints(selectedCourse.waypoints);
              if (wps.length > 0) {
                const dest = wps[wps.length - 1];
                const encodedName = encodeURIComponent(dest.name);
                const kakaoFallbackUrl = `https://map.kakao.com/link/to/${encodedName},${dest.lat},${dest.lng}`;
                
                const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const isRealMobile = isMobileDevice && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
                
                if (isRealMobile) {
                  const naviUrl = `kakaonavi://route?dname=${encodedName}&dx=${dest.lng}&dy=${dest.lat}&coord_type=wgs84`;
                  const start = Date.now();
                  window.location.href = naviUrl;
                  setTimeout(() => {
                    if (Date.now() - start < 1500) {
                      window.location.href = kakaoFallbackUrl;
                    }
                  }, 1000);
                } else {
                  window.open(kakaoFallbackUrl, '_blank');
                }
              }
            }}
            className="w-full bg-[#FEE500] hover:bg-[#F4DC00] text-[#191919] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <span className="text-lg">🚕</span> 카카오내비
          </button>
        </div>
        
        {/* 쿠팡 파트너스 배너 (수익화) */}
        <div className="mt-6 mb-2">
          <a 
            href="https://link.coupang.com/a/d9GFO0yULs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl p-4 shadow-lg hover:-translate-y-1 transition-transform relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/20 rounded-full blur-xl group-hover:bg-white/30 transition-colors"></div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-white font-black text-sm mb-1">드라이브 갈 때 이거 챙겼어? 👀</p>
                <p className="text-pink-100 text-xs font-semibold">차량 필수템 / 간식 로켓배송</p>
              </div>
              <div className="bg-white text-rose-500 w-8 h-8 rounded-full flex items-center justify-center font-black shadow-md group-hover:scale-110 transition-transform">
                ➔
              </div>
            </div>
            <p className="text-[8px] text-white/50 mt-2 text-right">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
          </a>
        </div>

        {/* 가상 주행 모드 버튼 (데스크톱/PC 전용) */}
        {isDesktop && (
          <button 
            onClick={startDriveMode}
            className="w-full mt-2 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="text-xl relative z-10">▶️</span>
            <span className="relative z-10 tracking-tight">10초 만에 코스 미리보기 (가상 주행)</span>
          </button>
        )}

        {/* 카카오톡 공유 버튼 */}
        <button 
          onClick={() => {
            const shareUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : "https://drive.weknews.com";
            const copyFallback = () => {
              try {
                navigator.clipboard.writeText(shareUrl);
                alert("🔗 코스 링크가 복사되었습니다! 카카오톡 대화창에 붙여넣어 공유해 보세요.");
              } catch (err) {
                alert("링크 복사에 실패했습니다. 주소창의 링크를 직접 복사하여 공유해주세요!");
              }
            };

            try {
              const isInitialized = window.Kakao && typeof window.Kakao.isInitialized === 'function';
              if (isInitialized && window.Kakao.Share) {
                if (!window.Kakao.isInitialized()) {
                  window.Kakao.init(KAKAO_APP_KEY);
                }
                
                window.Kakao.Share.sendDefault({
                  objectType: 'feed',
                  content: {
                    title: `[Drive Map] ${selectedCourse.title}`,
                    description: selectedCourse.description,
                    imageUrl: selectedCourse.imageUrl || 'https://drive.weknews.com/images/hero.png',
                    link: {
                      mobileWebUrl: shareUrl,
                      webUrl: shareUrl,
                    },
                  },
                  buttons: [
                    {
                      title: '코스 자세히 보기',
                      link: {
                        mobileWebUrl: shareUrl,
                        webUrl: shareUrl,
                      },
                    },
                  ],
                });
              } else {
                copyFallback();
              }
            } catch (error) {
              console.error("Kakao share error:", error);
              copyFallback();
            }
          }}
          className="w-full mt-3 bg-[#FEE500] hover:bg-[#F4DC00] text-[#191919] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
        >
          <span className="text-xl">💬</span> 카카오톡 공유하기
        </button>
      </div>
    );
  };

  if (!isMounted) {
    return (
      <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 font-bold z-50">
        <span className="text-4xl animate-spin mb-4">🌀</span>
        <p>드라이브 맵 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full flex flex-col md:flex-row bg-slate-950 overflow-hidden" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}>
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

      {/* 1. 모바일 전용 세로형 스크롤 랜딩 레이아웃 (선택된 코스가 없고 리스트 탭일 때 노출) */}
      {isMobile && activeTab === 'list' && (
        <div className="w-full h-full overflow-y-auto bg-slate-950 flex flex-col scroll-smooth">
          {/* 모바일 상단 고정 헤더 */}
          <header className="sticky top-0 w-full z-50 bg-slate-950/85 backdrop-blur-xl border-b border-slate-900/50 flex justify-between items-center h-16 px-4 shrink-0">
            <span className="font-extrabold italic text-xl tracking-tighter text-white-glare">DRIVE MAP</span>
            <button 
              onClick={() => setIsInquiryModalOpen(true)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
            >
              제안 및 문의 💡
            </button>
          </header>

          {/* 히어로 섹션 */}
          <div className="relative w-full h-[55vh] min-h-[360px] flex items-center justify-center overflow-hidden shrink-0">
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-50 scale-105"
              style={{ backgroundImage: "url('/images/hero.png')" }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/10 to-slate-950"></div>
            <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1.5px]"></div>
            
            <div className="relative z-10 text-center px-6 max-w-md flex flex-col items-center">
              <div className="inline-block bg-sky-500/10 border border-sky-500/30 rounded-full px-4 py-1 mb-4 backdrop-blur-md">
                <span className="text-[10px] font-bold text-sky-400 tracking-widest uppercase">전국 감성 드라이브 코스</span>
              </div>
              <h1 className="text-5xl font-black italic text-white mb-3 tracking-tighter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                DRIVE MAP
              </h1>
              <p className="text-slate-300 text-sm font-semibold mb-8 max-w-[240px] drop-shadow-md leading-relaxed">
                답답한 도심을 벗어나<br/>완벽한 궤적을 그리며 달려보세요
              </p>
              <button 
                onClick={scrollToCourseList}
                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-sm px-9 py-3.5 rounded-full flex items-center gap-2 shadow-[0_4px_20px_rgba(14,165,233,0.3)] transition-all group active:scale-95"
              >
                드라이브 시작하기 <span className="group-hover:translate-x-1 transition-transform">🏁</span>
              </button>
            </div>
          </div>

          {/* PWA 앱 설치 */}
          <div className="px-4 mt-2">
            <PWAInstallButton />
          </div>

          {/* 벤토 테마 카드 */}
          <div className="px-4 py-4 shrink-0">
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-1.5">
              <span className="text-sky-500">✨</span> 테마별 드라이브 코스
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {/* 명예의 전당 */}
              <button 
                onClick={() => {
                  setActiveCuration('ranking');
                  setActiveTheme('all');
                  setActiveRegion('all');
                  setSearchQuery('');
                  setIsSortedByDistance(false);
                  scrollToCourseList();
                }}
                className={`relative overflow-hidden rounded-2xl aspect-[4/3] border p-4 text-left flex flex-col justify-end transition-all active:scale-[0.98] group ${
                  activeCuration === 'ranking' 
                    ? 'border-sky-500 shadow-lg shadow-sky-500/20' 
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* 배경 이미지 */}
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700 z-0"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&auto=format&fit=crop')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-[1]"></div>
                <div className="relative z-10">
                  <span className="text-2xl mb-1 block group-hover:animate-bounce transition-all">👑</span>
                  <h3 className="text-xs font-bold text-white">명예의 전당</h3>
                  <p className="text-[9px] text-slate-300 mt-0.5">최고 평점 코스 모음</p>
                </div>
              </button>

              {/* 봄꽃 드라이브 */}
              <button 
                onClick={() => {
                  setActiveCuration('spring');
                  setActiveTheme('all');
                  setActiveRegion('all');
                  setSearchQuery('');
                  setIsSortedByDistance(false);
                  scrollToCourseList();
                }}
                className={`relative overflow-hidden rounded-2xl aspect-[4/3] border p-4 text-left flex flex-col justify-end transition-all active:scale-[0.98] group ${
                  activeCuration === 'spring' 
                    ? 'border-sky-500 shadow-lg shadow-sky-500/20' 
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* 배경 이미지 */}
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700 z-0"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=600&auto=format&fit=crop')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-[1]"></div>
                <div className="relative z-10">
                  <span className="text-2xl mb-1 block group-hover:animate-bounce transition-all">🌸</span>
                  <h3 className="text-xs font-bold text-white">봄꽃 드라이브</h3>
                  <p className="text-[9px] text-slate-300 mt-0.5">시즌 한정 벚꽃 로드</p>
                </div>
              </button>

              {/* 초보운전 안심 */}
              <button 
                onClick={() => {
                  setActiveCuration('beginner');
                  setActiveTheme('all');
                  setActiveRegion('all');
                  setSearchQuery('');
                  setIsSortedByDistance(false);
                  scrollToCourseList();
                }}
                className={`relative overflow-hidden rounded-2xl aspect-[4/3] border p-4 text-left flex flex-col justify-end transition-all active:scale-[0.98] group ${
                  activeCuration === 'beginner' 
                    ? 'border-sky-500 shadow-lg shadow-sky-500/20' 
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* 배경 이미지 */}
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700 z-0"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&w=600&q=80')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-[1]"></div>
                <div className="relative z-10">
                  <span className="text-2xl mb-1 block group-hover:animate-bounce transition-all">🚗</span>
                  <h3 className="text-xs font-bold text-white">초보운전 안심</h3>
                  <p className="text-[9px] text-slate-300 mt-0.5">넓고 안전한 직진 코스</p>
                </div>
              </button>

              {/* 야경 드라이브 */}
              <button 
                onClick={() => {
                  setActiveTheme('야경 드라이브');
                  setActiveCuration(null);
                  setActiveRegion('all');
                  setSearchQuery('');
                  setIsSortedByDistance(false);
                  scrollToCourseList();
                }}
                className={`relative overflow-hidden rounded-2xl aspect-[4/3] border p-4 text-left flex flex-col justify-end transition-all active:scale-[0.98] group ${
                  activeTheme === '야경 드라이브' 
                    ? 'border-sky-500 shadow-lg shadow-sky-500/20' 
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* 배경 이미지 */}
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700 z-0"
                  style={{ backgroundImage: "url('/images/bukak_skyway.png')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-[1]"></div>
                <div className="relative z-10">
                  <span className="text-2xl mb-1 block group-hover:animate-bounce transition-all">🌃</span>
                  <h3 className="text-xs font-bold text-white">야경 드라이브</h3>
                  <p className="text-[9px] text-slate-300 mt-0.5">도시의 불빛을 따라서</p>
                </div>
              </button>
            </div>
          </div>

          {/* 코스 목록 및 검색 영역 */}
          <div id="course-list-section" className="px-4 py-4 bg-slate-950 scroll-mt-16">
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-1.5">
              <span>📍</span> 코스 탐색
            </h2>

            {/* 검색창 */}
            <div className="relative mb-3 w-full">
              <input 
                type="text" 
                placeholder="지역, 코스명 검색 (예: 북한강)" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-white pl-10 pr-10 py-3 rounded-xl focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-slate-600 text-sm"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black"
                >
                  ✕
                </button>
              ) : (
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
              )}
            </div>

            {/* 지역 필터 칩 */}
            <div className="flex overflow-x-auto gap-1.5 pb-2 scrollbar-hide">
              {REGIONS.map((region) => (
                <button 
                  key={region.id}
                  onClick={() => {
                    setActiveRegion(region.id);
                    setActiveCuration(null);
                  }}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    activeRegion === region.id 
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-500/20' 
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  {region.name}
                </button>
              ))}
            </div>

            {/* 정렬 및 메타 정보 */}
            <div className="flex justify-between items-center mb-4 mt-2">
              <span className="text-xs font-bold text-slate-400">
                총 {filteredCourses.length}개 코스
              </span>
              <button 
                onClick={handleSortByDistance}
                disabled={isLocating}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all border flex items-center gap-1 ${
                  isSortedByDistance 
                    ? 'bg-red-600 text-white border-red-500' 
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                }`}
              >
                {isLocating ? '위치 파악중...' : `📍 ${isSortedByDistance ? '정렬 해제' : '내 주변순'}`}
              </button>
            </div>

            {/* 코스 카드 목록 */}
            <div className="space-y-4">
              {filteredCourses.length > 0 ? (
                filteredCourses.map((course, index) => (
                  <div 
                    key={course.id}
                    onClick={() => {
                      const wps = parseWaypoints(course.waypoints);
                      handleCourseClick(course, wps);
                    }}
                    className="bg-slate-900/60 border border-slate-900 rounded-2xl overflow-hidden hover:border-sky-500/50 transition-all flex flex-col active:scale-[0.99]"
                  >
                    {course.imageUrl ? (
                      <div 
                        className="w-full h-36 bg-cover bg-center relative"
                        style={{ backgroundImage: `url("${course.imageUrl}")` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                        {activeCuration === 'ranking' && (
                          <span className="absolute top-3 left-3 bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded shadow-md">
                            {index + 1}위
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-24 bg-slate-850 flex items-center justify-center text-3xl">
                        🚗
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className="text-white font-bold text-base leading-tight">
                            {course.title}
                          </h3>
                          <button 
                            onClick={(e) => toggleFavorite(course.id, e)}
                            className="text-lg p-1 -mt-1"
                          >
                            {favorites.includes(course.id) ? '❤️' : '🤍'}
                          </button>
                        </div>
                        <p className="text-slate-400 text-xs line-clamp-2 mb-3">
                          {course.description}
                        </p>
                      </div>
                      {(() => {
                        const stats = getCourseStats(course);
                        return (
                          <div className="flex items-center gap-3 pt-2.5 border-t border-slate-900">
                            <span className="bg-slate-950 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <span>🧭</span> {stats.distance}
                            </span>
                            <span className="bg-slate-950 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <span>⏱️</span> {stats.duration}
                            </span>
                            {typeof course._distanceToUser === 'number' && (
                              <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/20">
                                내 위치에서 {course._distanceToUser.toFixed(1)}km
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-600 text-sm font-bold">
                  조건에 맞는 코스가 없습니다 🥲
                </div>
              )}
            </div>
          </div>

          {/* 하단 푸터 */}
          <footer className="bg-slate-950 border-t border-slate-900 py-8 px-4 text-center mt-auto shrink-0">
            <span className="font-extrabold italic text-sm text-slate-700 block mb-1">DRIVE MAP</span>
            <p className="text-slate-600 text-[9px]">© 2026 DRIVE MAP. Engineered for Speed.</p>
          </footer>
        </div>
      )}

      {/* 2. 모바일 코스 상세 맵 레이아웃 (코스 선택 시 노출할 뒤로가기 버튼) */}
      {isMobile && selectedCourse && (
        <div className="absolute top-4 left-4 z-20">
          <button 
            onClick={closeCourseAndReturnToList}
            className="flex items-center gap-1.5 text-white font-bold text-xs bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-full border border-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
          >
            <span>←</span> <span>목록으로 돌아가기</span>
          </button>
        </div>
      )}

      {/* 스크립트는 useEffect 내부에서 동적으로 로드됩니다 */}

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
      <div suppressHydrationWarning className={`absolute z-20 top-1/2 -translate-y-1/2 right-4 md:transform-none md:top-auto md:bottom-20 md:right-auto md:left-[424px] flex flex-col gap-2 shadow-[0_5px_15px_rgba(0,0,0,0.3)] ${(!isMobile || activeTab === 'map') ? 'flex' : 'hidden'}`}>
        <button 
          onClick={findMyLocation}
          disabled={isLocatingMap}
          className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-white hover:text-sky-600 transition-colors shadow-sm"
          title="내 위치"
        >
          {isLocatingMap ? <span className="animate-spin text-sm">🌀</span> : "🎯"}
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

      {/* 가상 주행 모드 HUD */}
      {isDriveMode && (
        <div className="absolute top-0 left-0 w-full p-4 z-50 pointer-events-none flex flex-col justify-between h-full pb-8">
          <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-700 shadow-2xl pointer-events-auto">
            <h2 className="text-white font-black text-xl mb-1">{selectedCourse?.title || '코스 미리보기'}</h2>
            <p className="text-sky-400 font-bold text-sm">코스를 따라 가상 주행을 진행 중입니다...</p>
          </div>
          <div className="pointer-events-auto flex gap-4 md:w-[400px] md:mx-auto">
            <button 
              onClick={() => {
                if(mapRef.current && driveLocation && window.kakao && window.kakao.maps) {
                  mapRef.current.panTo(new window.kakao.maps.LatLng(driveLocation.lat, driveLocation.lng));
                  mapRef.current.setLevel(3);
                }
              }}
              className="w-16 h-16 bg-white text-sky-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] text-2xl font-black border-4 border-slate-200 active:scale-95 transition-transform shrink-0"
            >
              📍
            </button>
            <button 
              onClick={stopDriveMode}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] active:scale-95 transition-all text-xl border-2 border-red-400"
            >
              미리보기 종료 ⏹️
            </button>
          </div>
        </div>
      )}

      {/* 완주 축하 팝업 */}
      <AnimatePresence>
        {showDriveCompleteModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[9999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
               <div className="absolute top-1/4 left-1/4 animate-bounce text-6xl drop-shadow-2xl">🎉</div>
               <div className="absolute top-1/3 right-1/4 animate-ping text-5xl drop-shadow-2xl">✨</div>
               <div className="absolute bottom-1/3 left-1/3 animate-pulse text-4xl drop-shadow-2xl">🎊</div>
            </div>
            
            <motion.div 
              initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }}
              className="bg-slate-800 border border-slate-600 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl relative z-10"
            >
              <div className="text-6xl mb-4 drop-shadow-lg">🔮</div>
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">수고하셨습니다!</h2>
              <p className="text-sky-400 font-bold text-lg mb-6">코스 미리보기를 완료했습니다</p>
              
              <div className="bg-gradient-to-b from-indigo-900/50 to-purple-900/50 rounded-2xl p-5 mb-6 border border-purple-500/30">
                <p className="text-purple-300 text-sm mb-2 font-bold tracking-widest">MYSTIC SAJU</p>
                <p className="text-xl font-black text-white drop-shadow-md leading-tight">
                  드라이브 가기 전,<br/>오늘 당신의 운명은?
                </p>
              </div>
              
              <button 
                onClick={() => {
                  window.open('https://mystic.weknews.com', '_blank');
                  setShowDriveCompleteModal(false);
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-purple-500/30 text-lg flex items-center justify-center gap-2"
              >
                <span>오늘 당신의 운명을 시험해 보세요!</span>
              </button>
              <button 
                onClick={() => setShowDriveCompleteModal(false)}
                className="mt-4 text-slate-400 hover:text-white text-sm font-semibold transition-colors underline underline-offset-4"
              >
                다음에 할게요
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PC 사이드바 */}
      {!isMobile && (
        <div suppressHydrationWarning className={`
          md:relative md:w-[400px] md:h-full md:bg-slate-900 md:border-r md:border-slate-800 md:flex md:flex-col md:p-6 md:z-20
          hidden md:flex
          ${isDriveMode ? 'hidden md:hidden' : ''}
        `}>
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
                closeCourseAndReturnToList();
              }}
              className="w-full bg-slate-800/80 border border-slate-700 text-white pl-4 pr-10 py-3 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 shadow-inner"
            />
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  closeCourseAndReturnToList();
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
                disabled={isLocating}
                className={`text-xs font-bold px-4 py-2 rounded-full transition-all border shadow-sm flex items-center gap-1 ${
                  isLocating
                    ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-wait'
                    : isSortedByDistance 
                      ? 'bg-red-500 text-white border-red-400 shadow-red-500/30' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isLocating ? (
                  <>
                    <span className="animate-spin mr-1">🌀</span> 위치 파악 중...
                  </>
                ) : (
                  <>📍 {isSortedByDistance ? '내 주변순 정렬 해제' : '내 주변순 정렬'}</>
                )}
              </button>
            </div>
          </div>

          {/* === SCROLLABLE WRAPPER START === */}
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative pr-2 -mr-2">
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
                  <div className="flex md:flex-wrap overflow-x-auto gap-2 pb-2 scrollbar-hide shrink-0 border-b border-slate-700/50 mb-2">
                    <button 
                      onClick={() => { setActiveTheme("all"); setActiveCuration(null); }}
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
                          setActiveCuration(null);
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

                  {/* 지역 필터 */}
                  <div className="flex md:flex-wrap overflow-x-auto gap-2 pb-4 scrollbar-hide shrink-0">
                    {REGIONS.map((region) => (
                      <button 
                        key={region.id}
                        onClick={() => {
                          setActiveRegion(region.id);
                          setActiveCuration(null);
                          setSelectedCourse(null);
                        }}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                          activeRegion === region.id 
                            ? 'bg-sky-600 text-white border-sky-500 shadow-lg shadow-sky-500/30' 
                            : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {region.name}
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

            <div className="flex flex-col flex-1 mt-2 relative">
              {!selectedCourse && !isHeaderVisible && (
                <div className="flex gap-2 pb-2 mb-2 px-1 shrink-0">
                  <button 
                    onClick={() => setIsHeaderVisible(true)}
                    className="flex-1 bg-slate-800/80 backdrop-blur-md text-xs text-indigo-400 font-black py-2.5 rounded-xl border border-slate-700/60 shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all hover:bg-slate-700 hover:text-indigo-300"
                  >
                    <span>🔽</span> <span>메뉴 펼치기</span>
                  </button>
                  {(activeCuration || activeTheme !== 'all' || activeRegion !== 'all' || searchQuery) && (
                    <button 
                      onClick={() => {
                        setActiveCuration(null);
                        setActiveTheme('all');
                        setActiveRegion('all');
                        setSearchQuery('');
                        setIsSortedByDistance(false);
                        setIsHeaderVisible(true);
                      }}
                      className="px-4 bg-slate-800/80 backdrop-blur-md text-xs text-slate-300 font-black py-2.5 rounded-xl border border-slate-700/60 shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all hover:bg-slate-700 hover:text-white"
                    >
                      <span>🔄</span> <span>필터 초기화</span>
                    </button>
                  )}
                </div>
              )}
              <div className="flex-1 pb-4">
                {selectedCourse ? (
                  renderCourseDetails(true)
                ) : filteredCourses.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-slate-300 text-sm font-bold px-2">총 {filteredCourses.length}개의 코스</p>
                    {filteredCourses.map((course, index) => (
                      <div 
                        key={course.id} 
                        onClick={() => {
                          const wps = parseWaypoints(course.waypoints);
                          handleCourseClick(course, wps);
                        }}
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/80 hover:bg-slate-700/80 hover:border-slate-500 transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="text-white font-bold group-hover:text-indigo-400 transition-colors flex-1 pr-2 flex items-center gap-1">
                            {activeCuration === 'ranking' && (
                              <span className="text-2xl mr-1 drop-shadow-md -mt-1">
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-md align-middle">{index + 1}위</span>}
                              </span>
                            )}
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
                        {(() => {
                          const stats = getCourseStats(course);
                          return (
                            <div className="flex flex-col gap-2.5">
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-indigo-400 font-bold">{stats.distance}</span>
                                <span className="text-xs text-slate-400">{stats.duration}</span>
                                {typeof course._distanceToUser === 'number' && (
                                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-sm font-bold border border-red-500/30">
                                    약 {course._distanceToUser.toFixed(1)}km
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const wps = parseWaypoints(course.waypoints);
                                  handleCourseClick(course, wps);
                                }}
                                className="w-full py-2 bg-sky-600/10 hover:bg-sky-600/20 border border-sky-500/30 text-sky-400 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200"
                              >
                                <span>🗺️</span> 지도 바로보기
                              </button>
                            </div>
                          );
                        })()}
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
              
              {/* 수익화 배너 영역 (구글 애드센스) - 코스 미선택 시에만 하단 고정 노출 */}
              {!selectedCourse && (
                <div className="mt-auto pt-6 w-full shrink-0">
                  <div className="w-full h-[250px] bg-slate-800/50 rounded-xl overflow-hidden shadow-sm">
                    <AdBanner 
                      dataAdSlot="4564542487" 
                      dataAdFormat="auto" 
                      dataFullWidthResponsive={true} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 지도 컨테이너 (모바일에서 목록 탭일 때는 hidden, 지도 탭일 때 노출) */}
      <div suppressHydrationWarning className={`flex-1 w-full h-full relative bg-slate-900 ${isMobile && activeTab !== 'map' ? 'hidden' : 'block'}`}>
        {(!mapLoaded || isLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
            <span className="text-4xl animate-spin mb-4">🌀</span>
            <p className="text-slate-300 font-bold">
              {isLoading ? "코스 데이터를 불러오는 중..." : "지도를 불러오는 중..."}
            </p>
          </div>
        )}
        <div id="map" ref={mapContainerRef} className="w-full h-full bg-slate-900"></div>

        {/* 🗺️ PC 전용: 플로팅 큐레이션 위젯 (지도 위) */}
        {!isMobile && (
          <div className="hidden md:flex absolute top-6 left-6 z-20 flex-wrap gap-2 max-w-[calc(100vw-450px)]">
            <button
              onClick={() => {
                setActiveCuration('ranking');
                setActiveTheme('all');
                setActiveRegion('all');
                setSearchQuery('');
                setIsSortedByDistance(false);
                setSelectedCourse(null);
                setIsHeaderVisible(false);
              }}
              className={`px-5 py-2.5 rounded-full font-black text-sm flex items-center gap-2 backdrop-blur-md transition-all border ${
                activeCuration === 'ranking'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 shadow-amber-500/40 ring-2 ring-amber-300'
                  : 'bg-white/40 text-slate-800 border-white/60 hover:bg-white/60 hover:border-white shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
              }`}
            >
              <span className={activeCuration === 'ranking' ? 'animate-bounce' : ''}>👑</span> 명예의 전당
            </button>

            {CURATION_CATEGORIES.filter(c => c.id !== 'ranking').map(cat => {
              const isActive = activeCuration === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (isActive) {
                      setActiveCuration(null);
                    } else {
                      setActiveCuration(cat.id);
                      setActiveTheme('all');
                      setActiveRegion('all');
                      setSearchQuery('');
                      setIsSortedByDistance(false);
                      setSelectedCourse(null);
                      setIsHeaderVisible(false);
                    }
                  }}
                  className={`px-4 py-2.5 rounded-full font-bold text-sm flex items-center gap-1.5 backdrop-blur-md transition-all border ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/40 ring-2 ring-indigo-300'
                      : 'bg-white/40 text-slate-800 border-white/60 hover:bg-white/60 hover:border-white shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* PC 우측 플로팅 배너 영역 */}
        {!isMobile && (
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
              className="group relative w-full h-[140px] bg-slate-900/80 backdrop-blur-lg rounded-2xl border border-slate-700/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-end shrink-0 transition-all hover:-translate-y-1 hover:shadow-sky-500/20"
            >
              {/* 자동차용품 배경 이미지 (어둡게 처리) */}
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1601362840469-51e4d8d58785?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent"></div>
              
              <div className="relative z-10 flex flex-col gap-1">
                <span className="bg-sky-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded w-fit tracking-wider shadow-lg">CAR ACCESSORIES</span>
                <h3 className="text-white font-black text-base leading-tight mt-1 group-hover:text-sky-100 transition-colors drop-shadow-md">
                  드라이브 필수 차량용품<br/>로켓배송 기획전
                </h3>
                <p className="text-slate-300 text-[11px] font-medium mt-1 flex items-center gap-1">
                  쿠팡 자동차용품 바로가기 <span className="group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </div>
            </a>

            {/* 세 번째 커스텀 배너 (쿠팡 파트너스 호텔/여행 수동 배너) */}
            <a
              href="https://link.coupang.com/a/d9adnYXKtE" 
              target="_blank"
              rel="noopener noreferrer" 
              className="group relative w-full h-[140px] bg-slate-900/80 backdrop-blur-lg rounded-2xl border border-slate-700/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-end shrink-0 transition-all hover:-translate-y-1 hover:shadow-rose-500/20"
            >
              {/* 호캉스 배경 이미지 (어둡게 처리) */}
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent"></div>
              
              <div className="relative z-10 flex flex-col gap-1">
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded w-fit tracking-wider shadow-lg">HOTEL & RESORT</span>
                <h3 className="text-white font-black text-base leading-tight mt-1 group-hover:text-rose-100 transition-colors drop-shadow-md">
                  드라이브 코스 주변<br/>전국 호캉스 특가 예약
                </h3>
                <p className="text-slate-300 text-[11px] font-medium mt-1 flex items-center gap-1">
                  쿠팡 트래블 바로가기 <span className="group-hover:translate-x-1 transition-transform">→</span>
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
        )}
      </div>

      {/* 모바일 하단 코스 디테일 바텀 시트 (Custom Framer-Motion Sheet) */}
      {isMobile && selectedCourse && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          {!isSheetMinimized ? (
            <>
              {/* 반투명 어두운 배경 오버레이 - 클릭 시 카드를 축소하여 지도 활성화 */}
              <div 
                onClick={() => setIsSheetMinimized(true)}
                className="absolute inset-0 bg-black/60 pointer-events-auto z-10"
              ></div>
              
              {/* 바텀 시트 본체 */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: "0%" }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.75 }}
                onDragEnd={(event: any, info: PanInfo) => {
                  if (info.offset.y > 100 || info.velocity.y > 500) {
                    setIsSheetMinimized(true);
                  }
                }}
                className="absolute bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl pointer-events-auto z-20 flex flex-col overflow-hidden max-h-[85vh] text-left"
              >
                {/* 드래그용 핸들러 바 */}
                <div className="w-full flex justify-center py-4 bg-slate-900 cursor-grab active:cursor-grabbing border-b border-slate-800/40 shrink-0">
                  <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
                </div>
                
                {/* 세부 내용 영역 (스크롤 가능) */}
                <div className="overflow-y-auto p-6 pt-3 pb-12 custom-scrollbar">
                  {renderCourseDetails(false)}
                </div>
              </motion.div>
            </>
          ) : (
            /* 축소(최소화) 상태일 때: 어두운 배경을 걷어내 지도를 보여주고 하단에 슬림형 요약 카드 노출 */
            <div 
              onClick={() => setIsSheetMinimized(false)}
              className="absolute bottom-6 left-4 right-4 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] pointer-events-auto z-20 cursor-pointer hover:bg-slate-800 transition-all flex items-center justify-between gap-4 animate-slide-up"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-extrabold text-xs truncate">{selectedCourse.title}</h3>
                <div className="flex gap-2 items-center mt-1">
                  <span className="text-[10px] text-indigo-400 font-bold">
                    {(() => {
                      const cached = cachedPathsRef.current[selectedCourse.id];
                      if (cached?.distance) return `${(cached.distance / 1000).toFixed(1)}km`;
                      return selectedCourse.distance || "";
                    })()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {(() => {
                      const cached = cachedPathsRef.current[selectedCourse.id];
                      if (cached?.duration) return `${Math.ceil(cached.duration / 60)}분`;
                      return selectedCourse.duration || "";
                    })()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-indigo-600/20 text-indigo-400 text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-indigo-500/30">
                  상세보기 🔼
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeCourseKeepMap();
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-black border border-slate-700/50"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 좌측 하단 제안 및 문의 플로팅 버튼 (데스크톱 전용) */}
      {!isMobile && (
        <button
          onClick={() => setIsInquiryModalOpen(true)}
          className="fixed bottom-6 left-6 z-50 bg-slate-800/90 backdrop-blur-md text-slate-300 hover:text-white px-4 py-3 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-slate-700 flex items-center justify-center gap-2 transition-all hover:-translate-y-1 hover:shadow-indigo-500/20 active:scale-95 group"
        >
          <span className="text-xl group-hover:animate-bounce">💡</span>
          <span className="text-sm font-bold tracking-tight">제안 및 문의</span>
        </button>
      )}

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



                {inquiryType === '광고/제휴 제안' ? (
                  <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl text-center flex flex-col items-center justify-center gap-3 mt-4">
                    <span className="text-3xl">🤝</span>
                    <p className="text-slate-300 text-sm">광고 및 비즈니스 제휴 문의는<br/>아래 대표 이메일로 연락 부탁드립니다.</p>
                    <a href="mailto:duke3736@gmail.com" className="text-indigo-400 font-bold text-lg hover:text-indigo-300 transition-colors bg-indigo-500/10 px-4 py-2 rounded-lg mt-1">
                      duke3736@gmail.com
                    </a>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 모바일 전용 탭 전환 버튼 - 코스 상세 및 미니 요약 카드를 볼 때는 화면을 가리지 않도록 숨김 처리 */}
      {isMounted && isMobile && !selectedCourse && (
        <button
          onClick={() => {
            const nextTab = activeTab === 'list' ? 'map' : 'list';
            setActiveTab(nextTab);
            if (nextTab === 'list') {
              setSelectedCourse(null);
              if (window.location.hash === '#course') {
                window.history.back();
              }
            }
          }}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold px-6 py-4 rounded-full shadow-[0_10px_35px_rgba(139,92,246,0.6)] border border-white/20 flex items-center justify-center gap-2.5 active:scale-95 hover:scale-105 transition-all duration-300 ring-2 ring-white/10"
        >
          {activeTab === 'list' ? (
            <>
              <span className="text-lg animate-bounce">🗺️</span> <span className="tracking-tight text-sm">지도 보기</span>
            </>
          ) : (
            <>
              <span className="text-lg">📋</span> <span className="tracking-tight text-sm">목록 보기</span>
            </>
          )}
        </button>
      )}

    </div>
  );
}
