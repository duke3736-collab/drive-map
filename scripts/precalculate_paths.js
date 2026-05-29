const fs = require('fs');
const https = require('https');

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzfw4oZwWHAan-m8F4-l0eq5JBZFyvfRQmvvl5PqQTCEhlDsNiGxmi0n_aUxzYjrV6W/exec";

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function parseWaypoints(str) {
  if (!str) return [];
  return str.split('|').map(pt => {
    const parts = pt.split(',');
    return { name: parts[0] || "", lat: parseFloat(parts[1] || "0"), lng: parseFloat(parts[2] || "0") };
  });
}

async function main() {
  console.log("Fetching courses from Google Sheet...");
  const courses = await fetchJson(GOOGLE_SHEET_URL);
  console.log(`Fetched ${courses.length} courses.`);

  const cachedPaths = {};

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const waypoints = parseWaypoints(course.waypoints);
    if (waypoints.length < 2) continue;

    const osrmCoords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;
    
    console.log(`[${i+1}/${courses.length}] Fetching route for: ${course.title}`);
    try {
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      
      if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const coordinates = route.geometry.coordinates.map(c => ({ lng: c[0], lat: c[1] }));
        cachedPaths[course.id] = {
          path: coordinates,
          distance: route.distance,
          duration: route.duration
        };
      } else {
        console.warn(`Failed to fetch route for ${course.title}`);
      }
      // Delay to avoid hitting OSRM too hard (they allow decent rate, but just in case)
      await new Promise(r => setTimeout(r, 200));
    } catch(err) {
      console.error(`Error fetching for ${course.title}:`, err.message);
    }
  }

  fs.writeFileSync('public/precalculated_paths.json', JSON.stringify(cachedPaths));
  console.log("Successfully generated public/precalculated_paths.json");
}

main().catch(console.error);
