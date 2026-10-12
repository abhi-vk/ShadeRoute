export const radians = (value) => (value * Math.PI) / 180;
export const degrees = (value) => (value * 180) / Math.PI;

export const bearingBetween = (a, b) => {
  const lat1 = radians(a[0]);
  const lat2 = radians(b[0]);
  const delta = radians(b[1] - a[1]);
  const y = Math.sin(delta) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
};

