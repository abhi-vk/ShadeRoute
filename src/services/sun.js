import SunCalc from 'suncalc';
import { degrees } from '../utils/math.js';
import { bearingBetween } from '../utils/math.js';

export const sunReading = (lat, lon, date) => {
  const position = SunCalc.getPosition(date, lat, lon);
  return {
    azimuth: (degrees(position.azimuth) + 180) % 360,
    altitude: degrees(position.altitude),
  };
};

export const recommendation = (travelBearing, sun) => {
  const relative = (sun.azimuth - travelBearing + 360) % 360;
  if (sun.altitude < 0) return { side: 'dark', sunSide: 'below the horizon' };
  if (Math.min(relative, Math.abs(relative - 180)) <= 15)
    return { side: 'minimal', sunSide: relative < 90 ? 'ahead' : 'behind' };
  const sunSide = relative < 180 ? 'RIGHT' : 'LEFT';
  return { side: sunSide === 'RIGHT' ? 'LEFT' : 'RIGHT', sunSide };
};

export function makeSegments(points, start, duration) {
  const sampleCount = Math.min(
    12,
    Math.max(2, Math.ceil(points.length / 10)),
  );

  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = sampleCount <= 1 ? 0 : index / (sampleCount - 1);
    const pointIndex = Math.min(
      points.length - 2,
      Math.floor(ratio * (points.length - 1)),
    );
    const nextRatio = Math.min(1, ratio + 1 / Math.max(1, sampleCount - 1));
    const nextIndex = Math.min(
      points.length - 1,
      Math.max(pointIndex + 1, Math.floor(nextRatio * (points.length - 1))),
    );
    const point = points[pointIndex];
    const next = points[nextIndex];
    const time = new Date(start.getTime() + duration * 60000 * ratio);
    const bearing = bearingBetween(point, next);
    const sun = sunReading(point[0], point[1], time);
    return { ratio, bearing, sun, recommendation: recommendation(bearing, sun), time };
  });
}

