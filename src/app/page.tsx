import DriveMapWrapper from "@/components/DriveMapWrapper";
import { getCourses } from "@/lib/courses";
import Script from "next/script";

export default async function Page() {

  const courses = await getCourses();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "드라이브 맵 (Drive Map)",
    "url": "https://drive.weknews.com",
    "description": "전국 최고의 감성 드라이브 코스 지도. 서울 근교, 경기도, 인천, 야경, 해안도로 등 테마별 드라이브 및 데이트 코스 추천",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://drive.weknews.com/?searchQuery={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <DriveMapWrapper />

      <noscript>
        <div className="sr-only">
          <h1>드라이브 맵 - 전국 감성 드라이브 코스</h1>
          <p>전국 최고의 감성 드라이브 코스 지도를 확인하세요. 서울 근교, 경기도, 인천, 야경, 해안도로 등 상황별 맞춤 데이트 코스 추천과 주변 핫플레이스 정보까지 드라이브 맵에서 한눈에 제공합니다.</p>
          <h2>추천 드라이브 코스 목록</h2>
          <ul>
            {courses.map((course: any) => (
              <li key={course.id}>
                <h3>{course.title}</h3>
                <p><strong>설명:</strong> {course.description}</p>
                <p><strong>테마:</strong> {course.theme}</p>
                <p><strong>태그:</strong> {course.tags}</p>
                <p><strong>경유지:</strong> {course.waypoints}</p>
                {course.distance && <p><strong>거리:</strong> {course.distance}</p>}
                {course.duration && <p><strong>예상 소요 시간:</strong> {course.duration}</p>}
              </li>
            ))}
          </ul>
        </div>
      </noscript>
    </>
  );
}
