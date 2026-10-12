import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapPreview({ points }) {
  const element = useRef();
  const map = useRef();

  useEffect(() => {
    if (!points || !element.current) return undefined;

    const mapInstance = L.map(element.current, { scrollWheelZoom: false });
    map.current = mapInstance;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance);

    const line = L.polyline(points, {
      color: '#236d5d',
      weight: 5,
      opacity: 0.85,
    }).addTo(mapInstance);

    L.circleMarker(points[0], {
      radius: 7,
      color: '#102c2b',
      fillColor: '#f6c453',
      fillOpacity: 1,
      weight: 3,
    }).addTo(mapInstance);

    L.circleMarker(points[points.length - 1], {
      radius: 7,
      color: '#102c2b',
      fillColor: '#f26c45',
      fillOpacity: 1,
      weight: 3,
    }).addTo(mapInstance);

    mapInstance.fitBounds(line.getBounds(), { padding: [25, 25] });

    return () => {
      if (map.current === mapInstance) map.current = null;
      mapInstance.remove();
    };
  }, [points]);

  return <div className="map" ref={element}></div>;
}

