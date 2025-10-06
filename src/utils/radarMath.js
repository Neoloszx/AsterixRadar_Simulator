// utils/radarMath.js
export const latLonToXY = (lat, lon, canvasWidth, canvasHeight) => {
  // สมมติให้ center = lat:13.7367, lon:100.5231
  const centerLat = 13.7367;
  const centerLon = 100.5231;
  const scale = 100000; // ปรับให้เหมาะกับ canvas

  const x = canvasWidth / 2 + (lon - centerLon) * scale;
  const y = canvasHeight / 2 - (lat - centerLat) * scale;

  return { x, y };
};

