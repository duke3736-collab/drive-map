const originStr = "126.3712,34.7915";
const viasStr = "126.3615,34.7855";
const destStr = "126.3611,34.7711";
const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originStr}&destination=${destStr}&waypoints=${viasStr}`;

fetch(url, {
  headers: {
    'Authorization': 'KakaoAK 2d61947eb21a47c40a278882a6965246',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  if (data.routes && data.routes.length > 0) {
    console.log("Distance:", data.routes[0].summary.distance);
  } else {
    console.log("No route", data);
  }
});
