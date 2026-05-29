fetch('http://localhost:3000/api/directions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ waypoints: [
    {lat: 37.5665, lng: 126.9780},
    {lat: 37.5651, lng: 126.9895}
  ]})
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
