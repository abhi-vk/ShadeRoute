const $ = (selector) => document.querySelector(selector);
const state = { origin: null, destination: null, route: null, map: null, routeLayer: null, markers: [] };

const departureInput = $('#departure');
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
departureInput.value = now.toISOString().slice(0, 16);
$('#compass-time').value = departureInput.value;

function toRadians(value) { return value * Math.PI / 180; }
function toDegrees(value) { return value * 180 / Math.PI; }
function bearingBetween(a, b) {
  const lat1 = toRadians(a[0]); const lat2 = toRadians(b[0]); const delta = toRadians(b[1] - a[1]);
  const y = Math.sin(delta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}
function distanceKm(a, b) {
  const earth = 6371; const dLat = toRadians(b[0] - a[0]); const dLon = toRadians(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[0])) * Math.cos(toRadians(b[0])) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function normalizeAngle(angle) { return ((angle + 540) % 360) - 180; }
function formatDirection(degrees) { const directions = ['N','NE','E','SE','S','SW','W','NW']; return directions[Math.round(degrees / 45) % 8]; }
function formatTime(date) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function parseDate(value) { return new Date(value); }

async function searchPlaces(query) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&namedetails=1&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'en-IN,en' } });
  if (!response.ok) throw new Error('Geocoding unavailable');
  return response.json();
}

function usePlace(place, input, suggestions) {
  input.value = place.display_name;
  input.dataset.lat = place.lat;
  input.dataset.lon = place.lon;
  input.dataset.placeName = place.display_name;
  suggestions.classList.remove('visible');
}

async function geocode(query, input, suggestions) {
  if (!query.trim()) return;
  suggestions.innerHTML = '<div class="suggestion">Searching...</div>'; suggestions.classList.add('visible');
  try {
    const places = await searchPlaces(query);
    suggestions.innerHTML = places.length ? places.map((place, index) => `<button type="button" class="suggestion" data-index="${index}">${place.display_name}</button>`).join('') : '<div class="suggestion">No places found. Try a nearby landmark.</div>';
    suggestions.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => usePlace(places[button.dataset.index], input, suggestions)));
  } catch (error) { suggestions.innerHTML = '<div class="suggestion">Could not search right now. Check your connection.</div>'; }
}

async function resolveTypedPlace(input) {
  if (input.dataset.lat && input.dataset.lon) return { lat: Number(input.dataset.lat), lon: Number(input.dataset.lon), name: input.dataset.placeName || input.value };
  const places = await searchPlaces(input.value);
  if (!places.length) throw new Error(`Could not find “${input.value}”. Try a nearby landmark or area.`);
  const place = places[0];
  usePlace(place, input, document.querySelector(`#${input.id}-suggestions`));
  return { lat: Number(place.lat), lon: Number(place.lon), name: place.display_name };
}

['origin', 'destination'].forEach((name) => {
  const input = $(`#${name}`); const suggestions = $(`#${name}-suggestions`); let timer;
  input.addEventListener('input', () => { input.dataset.lat = ''; input.dataset.lon = ''; input.dataset.placeName = ''; clearTimeout(timer); if (input.value.length < 2) { suggestions.classList.remove('visible'); return; } timer = setTimeout(() => geocode(input.value, input, suggestions), 350); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && suggestions.querySelector('button')) { event.preventDefault(); suggestions.querySelector('button').click(); } });
  $(`[data-clear="${name}"]`).addEventListener('click', () => { input.value = ''; input.dataset.lat = ''; input.dataset.lon = ''; input.dataset.placeName = ''; input.focus(); });
});
document.addEventListener('click', (event) => { if (!event.target.closest('.location-field')) document.querySelectorAll('.suggestions').forEach((item) => item.classList.remove('visible')); });

document.querySelectorAll('.mode-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.mode-tab').forEach((item) => { item.classList.remove('active'); item.setAttribute('aria-selected', 'false'); }); tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
  $('#route-form').hidden = tab.dataset.mode !== 'route'; $('#compass-form').hidden = tab.dataset.mode !== 'compass';
}));

function sunReading(lat, lon, date) { const sun = SunCalc.getPosition(date, lat, lon); return { azimuth: (toDegrees(sun.azimuth) + 180) % 360, altitude: toDegrees(sun.altitude) }; }
function browserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ latitude: 40.7128, longitude: -74.006 }); return; }
    navigator.geolocation.getCurrentPosition((position) => resolve(position.coords), () => resolve({ latitude: 40.7128, longitude: -74.006 }), { timeout: 2500 });
  });
}
function recommendation(travelBearing, sun) {
  const relative = (sun.azimuth - travelBearing + 360) % 360; const frontBack = Math.min(relative, 360 - relative, Math.abs(180 - relative));
  if (sun.altitude < 0) return { side: 'dark', sunSide: 'below the horizon', label: 'No sun exposure expected' };
  if (Math.min(relative, Math.abs(relative - 180)) <= 15) return { side: 'minimal', sunSide: relative < 90 ? 'ahead' : 'behind', label: 'Minimal side exposure' };
  const sunSide = relative < 180 ? 'RIGHT' : 'LEFT';
  return { side: sunSide === 'RIGHT' ? 'LEFT' : 'RIGHT', sunSide, label: sun.altitude > 70 ? 'Sun is nearly overhead' : `Sun is on your ${sunSide}` };
}
function interpolatePoint(points, ratio) { const index = Math.min(points.length - 2, Math.floor(ratio * (points.length - 1))); return points[index]; }
function makeSegments(points, start, duration) {
  const sampleCount = Math.min(12, Math.max(2, Math.ceil(points.length / 10))); const segments = [];
  for (let i = 0; i < sampleCount; i += 1) { const ratio = sampleCount === 1 ? 0 : i / (sampleCount - 1); const point = interpolatePoint(points, ratio); const next = interpolatePoint(points, Math.min(1, ratio + 1 / (sampleCount - 1))); const bearing = bearingBetween(point, next); const moment = new Date(start.getTime() + duration * 60000 * ratio); const sun = sunReading(point[0], point[1], moment); segments.push({ ratio, bearing, sun, recommendation: recommendation(bearing, sun), time: moment }); }
  return segments;
}

function showResult({ segments, duration, distance, points, start, routeName = 'your route' }) {
  const valid = segments.filter((segment) => segment.recommendation.side !== 'dark'); const dark = valid.length === 0;
  const counts = { LEFT: 0, RIGHT: 0, minimal: 0 }; valid.forEach((segment) => { if (counts[segment.recommendation.side] !== undefined) counts[segment.recommendation.side] += 1; });
  const dominant = counts.LEFT >= counts.RIGHT ? 'LEFT' : 'RIGHT'; const share = valid.length ? counts[dominant] / valid.length : 0; const first = segments[0]; const last = segments[segments.length - 1];
  const result = $('#result'); result.hidden = false; result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#sun-status').textContent = dark ? 'Night journey' : `${formatDirection(first.sun.azimuth)} sun · ${Math.round(first.sun.altitude)}° high`;
  const title = $('#result-title'); const summary = $('#result-summary'); const callout = $('#seat-callout-text');
  const seatVisual = document.querySelector('.seat-visual');
  const bestSeat = dark ? null : (share >= .7 || duration < 10 ? dominant : first.recommendation.side);
  seatVisual.classList.toggle('night', dark); seatVisual.classList.toggle('sun-left', bestSeat === 'RIGHT');
  if (dark) { title.textContent = 'It’ll be dark out there.'; summary.textContent = 'No sun exposure expected for this journey.'; callout.textContent = 'Any seat will do'; } else if (share >= .7 || duration < 10) { title.textContent = `Sit on the ${dominant.toLowerCase()} side.`; summary.textContent = `The sun will be on your ${dominant === 'LEFT' ? 'right' : 'left'} for most of ${routeName} (${formatTime(start)} – ${formatTime(last.time)}).`; callout.textContent = `Best shaded seat · ${dominant}`; } else { title.textContent = 'The shade changes on the way.'; summary.textContent = `Start on the ${first.recommendation.side.toLowerCase()} side, then follow the timeline as the road bends.`; callout.textContent = `Start on the ${first.recommendation.side}`; }
  $('#sun-direction').textContent = dark ? 'Below horizon' : `${formatDirection(first.sun.azimuth)} · ${Math.round(first.sun.azimuth)}°`; $('#sun-altitude').textContent = dark ? '0°' : `${Math.round(first.sun.altitude)}°`; $('#route-bends').textContent = `${Math.round(distance)} km · ${share >= .7 ? 'gentle' : 'curvy'}`;
  $('#timeline').innerHTML = segments.map((segment, index) => { const item = segment.recommendation; const side = item.side === 'dark' ? 'DARK' : item.side === 'minimal' ? 'FRONT / BACK' : `SIT ${item.side}`; return `<div class="timeline-item"><time>${formatTime(segment.time)}</time><span>Road heading ${formatDirection(segment.bearing)} · sun ${Math.round(segment.sun.altitude)}°</span><strong class="timeline-side ${item.side.toLowerCase()}">${side}</strong></div>`; }).join('');
  if (points) renderMap(points, start, segments);
}

function renderMap(points, start, segments) {
  if (!state.map) { state.map = L.map('map', { scrollWheelZoom: false }); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(state.map); }
  if (state.routeLayer) state.routeLayer.remove(); state.markers.forEach((marker) => marker.remove()); state.markers = [];
  state.routeLayer = L.polyline(points.map((point) => [point[0], point[1]]), { color: '#236d5d', weight: 5, opacity: .85 }).addTo(state.map); state.map.fitBounds(state.routeLayer.getBounds(), { padding: [25, 25] });
  [points[0], points[points.length - 1]].forEach((point, index) => { const marker = L.circleMarker([point[0], point[1]], { radius: 7, color: '#102c2b', fillColor: index ? '#f26c45' : '#f6c453', fillOpacity: 1, weight: 3 }).addTo(state.map); state.markers.push(marker); });
}

async function fetchRoute(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url); if (!response.ok) throw new Error('Route service unavailable'); const data = await response.json(); if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No drivable route found'); return data.routes[0];
}
$('#route-form').addEventListener('submit', async (event) => { event.preventDefault(); const button = event.target.querySelector('.primary-btn'); const originInput = $('#origin'); const destinationInput = $('#destination'); if (!originInput.value.trim() || !destinationInput.value.trim()) { alert('Enter both a starting point and destination.'); return; } button.disabled = true; button.querySelector('span').textContent = 'Finding your places…'; try { const start = parseDate(departureInput.value); const duration = Number($('#duration').value) || 45; const origin = await resolveTypedPlace(originInput); const destination = await resolveTypedPlace(destinationInput); button.querySelector('span').textContent = 'Reading the road…'; const route = await fetchRoute(origin, destination); const points = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]); const segments = makeSegments(points, start, duration); showResult({ segments, duration, distance: route.distance / 1000, points, start, routeName: destination.name.split(',')[0] }); } catch (error) { alert(error.message || 'Could not calculate this route.'); } finally { button.disabled = false; button.querySelector('span').textContent = 'Find my shade'; } });
$('#compass-form').addEventListener('submit', async (event) => { event.preventDefault(); const start = parseDate($('#compass-time').value); const bearing = Number($('#direction').value); const location = await browserLocation(); const localSun = sunReading(location.latitude, location.longitude, start); showResult({ segments: [{ bearing, sun: localSun, recommendation: recommendation(bearing, localSun), time: start }], duration: 5, distance: 0, start }); });
$('#reset-btn').addEventListener('click', () => { $('#result').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' }); });
document.querySelector('.details-panel').addEventListener('toggle', (event) => { if (event.target.open && state.map) setTimeout(() => state.map.invalidateSize(), 50); });
