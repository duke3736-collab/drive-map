import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { waypoints } = await request.json();
    
    if (!waypoints || waypoints.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 waypoints' }, { status: 400 });
    }

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const vias = waypoints.slice(1, -1);

    const originStr = `${origin.lng},${origin.lat}`;
    const destStr = `${destination.lng},${destination.lat}`;
    const viasStr = vias.length > 0 ? vias.map((v: any) => `${v.lng},${v.lat}`).join('|') : '';

    let url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originStr}&destination=${destStr}`;
    if (viasStr) {
      url += `&waypoints=${viasStr}`;
    }

    let data;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `KakaoAK 2d61947eb21a47c40a278882a6965246`,
          'Content-Type': 'application/json'
        }
      });
      data = await response.json();
    } catch (err) {
      console.error("Kakao fetch error", err);
      data = { code: -1 }; // Force fallback
    }

    // 카카오 API 한도 초과(code -10) 또는 에러 시 OSRM 무료 라우팅 API 폴백
    if (data.code === -10 || !data.routes || data.routes.length === 0) {
      console.log("Kakao API Failed or Limit Exceeded. Falling back to OSRM...");
      
      const osrmCoords = waypoints.map((wp: any) => `${wp.lng},${wp.lat}`).join(';');
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;
      
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      
      if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        
        // 프론트엔드가 기대하는 카카오 포맷으로 변환
        const convertedRoutes = [{
          summary: {
            distance: route.distance,
            duration: route.duration
          },
          sections: [{
            roads: [{
              vertexes: route.geometry.coordinates.flatMap((c: number[]) => [c[0], c[1]])
            }]
          }]
        }];
        
        return NextResponse.json({ routes: convertedRoutes });
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Directions API error:', error);
    return NextResponse.json({ error: 'Failed to fetch directions' }, { status: 500 });
  }
}
