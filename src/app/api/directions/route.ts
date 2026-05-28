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
    const viasStr = vias.map((v: any) => `${v.lng},${v.lat}`).join('|');

    let url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originStr}&destination=${destStr}`;
    if (viasStr) {
      url += `&waypoints=${viasStr}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `KakaoAK 2d61947eb21a47c40a278882a6965246`, // User's REST API Key
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log("Kakao Navi Response:", JSON.stringify(data).substring(0, 300));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Directions API error:', error);
    return NextResponse.json({ error: 'Failed to fetch directions' }, { status: 500 });
  }
}
