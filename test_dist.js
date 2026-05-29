function getDistance(lat1, lon1, lat2, lon2) {
  var p = 0.017453292519943295;
  var c = Math.cos;
  var a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * 
          (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a));
}
console.log(getDistance(34.7915, 126.3712, 34.7855, 126.3615) + getDistance(34.7855, 126.3615, 34.7711, 126.3611));
