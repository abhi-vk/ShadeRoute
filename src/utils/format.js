const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const formatDirection = (value) =>
  DIRECTIONS[Math.round(value / 45) % 8];

export const formatTime = (date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

