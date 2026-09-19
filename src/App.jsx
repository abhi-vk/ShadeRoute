import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import SunCalc from 'suncalc';

const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const STORAGE_KEY = 'shaderoute-recent-locations';

const defaultDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const radians = (value) => (value * Math.PI) / 180;
const degrees = (value) => (value * 180) / Math.PI;

const bearingBetween = (a, b) => {
  const lat1 = radians(a[0]);
  const lat2 = radians(b[0]);
  const delta = radians(b[1] - a[1]);
  const y = Math.sin(delta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
};

const formatDirection = (value) => directions[Math.round(value / 45) % 8];
const formatTime = (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const sunReading = (lat, lon, date) => {
  const position = SunCalc.getPosition(date, lat, lon);
  return { azimuth: (degrees(position.azimuth) + 180) % 360, altitude: degrees(position.altitude) };
};

const recommendation = (travelBearing, sun) => {
  const relative = (sun.azimuth - travelBearing + 360) % 360;
  if (sun.altitude < 0) return { side: 'dark', sunSide: 'below the horizon' };
  if (Math.min(relative, Math.abs(relative - 180)) <= 15) return { side: 'minimal', sunSide: relative < 90 ? 'ahead' : 'behind' };
  const sunSide = relative < 180 ? 'RIGHT' : 'LEFT';
  return { side: sunSide === 'RIGHT' ? 'LEFT' : 'RIGHT', sunSide };
};

async function searchPlaces(query, signal) {
  const encoded = encodeURIComponent(query);

  const photon = fetch(`https://photon.komoot.io/api/?q=${encoded}&limit=8&lang=en`, { signal }).then(async (response) => {
    if (!response.ok) throw new Error();
    const data = await response.json();
    return (data.features || [])
      .map((feature) => {
        const properties = feature.properties || {};
        const address = [properties.street, properties.city, properties.state, properties.postcode, properties.country].filter(Boolean).join(', ');
        return {
          display_name: [properties.name, address].filter(Boolean).join(', '),
          lat: feature.geometry.coordinates[1],
          lon: feature.geometry.coordinates[0],
        };
      })
      .filter((place) => place.display_name);
  });

  const nominatim = fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&namedetails=1&q=${encoded}`,
    { headers: { 'Accept-Language': 'en-IN,en' }, signal },
  ).then(async (response) => {
    if (!response.ok) throw new Error();
    return response.json();
  });

  const results = await Promise.allSettled([photon, nominatim]);
  const unique = new Map();

  results
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value)
    .forEach((place) => {
      const key = `${Number(place.lat).toFixed(4)},${Number(place.lon).toFixed(4)}`;
      if (!unique.has(key)) unique.set(key, place);
    });

  const normalizedQuery = query.trim().toLowerCase();
  const words = normalizedQuery.split(/[^a-z0-9]+/).filter((word) => word.length > 1);
  const score = (place) => {
    const name = place.display_name.toLowerCase();
    const exactStart = name.startsWith(normalizedQuery) ? 12 : 0;
    const exactPhrase = name.includes(normalizedQuery) ? 6 : 0;
    const matchedWords = words.reduce((total, word) => total + (name.includes(word) ? 2 : 0), 0);
    return exactStart + exactPhrase + matchedWords;
  };

  return [...unique.values()].sort((a, b) => score(b) - score(a) || a.display_name.localeCompare(b.display_name)).slice(0, 8);
}

function makeSegments(points, start, duration) {
  const sampleCount = Math.min(12, Math.max(2, Math.ceil(points.length / 10)));

  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = index / (sampleCount - 1);
    const point = points[Math.min(points.length - 2, Math.floor(ratio * (points.length - 1)))];
    const next = points[Math.min(points.length - 2, Math.floor(Math.min(1, ratio + 1 / (sampleCount - 1)) * (points.length - 1)))];
    const time = new Date(start.getTime() + duration * 60000 * ratio);
    const bearing = bearingBetween(point, next);
    const sun = sunReading(point[0], point[1], time);
    return { ratio, bearing, sun, recommendation: recommendation(bearing, sun), time };
  });
}

function getRecentLocations() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.display_name) : [];
  } catch {
    return [];
  }
}

function LocationField({ label, name, placeholder, value, setValue, setPlace, recentLocations, onSelectRecent, onClearRecent }) {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef();
  const request = useRef();

  useEffect(() => () => {
    clearTimeout(timer.current);
    request.current?.abort();
  }, []);

  const search = (text) => {
    clearTimeout(timer.current);
    request.current?.abort();
    setValue(text);
    setPlace(null);
    setActiveIndex(-1);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      setSearching(true);
      try {
        const places = await searchPlaces(text, controller.signal);
        if (!controller.signal.aborted) setSuggestions(places);
      } catch (error) {
        if (error.name !== 'AbortError') setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
  };

  const handleSelect = (place) => {
    setValue(place.display_name);
    setPlace(place);
    setSuggestions([]);
    setFocused(false);
    setActiveIndex(-1);
  };

  const handleSelectRecent = (place) => {
    onSelectRecent(place);
    setFocused(false);
    setActiveIndex(-1);
  };

  const recentItems = suggestions.length === 0 && !value.trim() ? recentLocations : [];
  const selectableItems = suggestions.length > 0 ? suggestions : recentItems;
  const showSuggestions = focused && (searching || selectableItems.length > 0);

  const handleKeyDown = (event) => {
    if (!showSuggestions) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % selectableItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + selectableItems.length) % selectableItems.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      if (suggestions.length > 0) handleSelect(suggestions[activeIndex]);
      else onSelectRecent(recentItems[activeIndex]);
    } else if (event.key === 'Escape') {
      setFocused(false);
      setSuggestions([]);
      setFocused(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="field location-field">
      <label htmlFor={name}>{label}</label>
      <div className="input-wrap">
        <span className={`field-icon ${name === 'origin' ? 'origin-icon' : 'destination-icon'}`}></span>
        <input
          id={name}
          autoComplete="off"
          value={value}
          onChange={(event) => search(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          aria-expanded={showSuggestions}
          aria-controls={`${name}-suggestions`}
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          className="clear-btn"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            setValue('');
            setPlace(null);
            setSuggestions([]);
          }}
        >
          ×
        </button>
      </div>

      {showSuggestions && (
        <div className="suggestions visible" id={`${name}-suggestions`} role="listbox">
          {searching ? (
            <div className="suggestion">Searching...</div>
          ) : (
            <>
              {suggestions.length > 0 &&
                suggestions.map((item, index) => (
                  <button type="button" role="option" aria-selected={activeIndex === index} className={`suggestion ${activeIndex === index ? 'active' : ''}`} key={`${item.lat}-${item.lon}`} onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelect(item)}>
                    {item.display_name}
                  </button>
                ))}

              {suggestions.length === 0 && recentItems.length > 0 && (
                <>
                  <div className="suggestion suggestion-label">
                    <span>Recent locations</span>
                    <button type="button" className="clear-recent-btn" onMouseDown={(event) => event.preventDefault()} onClick={onClearRecent}>Clear</button>
                  </div>
                  {recentItems.map((item, index) => (
                    <button type="button" role="option" aria-selected={activeIndex === index} className={`suggestion recent-item ${activeIndex === index ? 'active' : ''}`} onMouseDown={(event) => event.preventDefault()}
                      key={`${item.display_name}-${item.lat}-${item.lon}`}
                      onClick={() => handleSelectRecent(item)}
                    >
                      {item.display_name}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MapPreview({ points }) {
  const element = useRef();
  const map = useRef();

  useEffect(() => {
    if (!points || !element.current) return undefined;

    const mapInstance = L.map(element.current, { scrollWheelZoom: false });
    map.current = mapInstance;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance);

    const line = L.polyline(points, { color: '#236d5d', weight: 5, opacity: 0.85 }).addTo(mapInstance);
    L.circleMarker(points[0], { radius: 7, color: '#102c2b', fillColor: '#f6c453', fillOpacity: 1, weight: 3 }).addTo(mapInstance);
    L.circleMarker(points[points.length - 1], { radius: 7, color: '#102c2b', fillColor: '#f26c45', fillOpacity: 1, weight: 3 }).addTo(mapInstance);
    mapInstance.fitBounds(line.getBounds(), { padding: [25, 25] });

    return () => {
      if (map.current === mapInstance) map.current = null;
      mapInstance.remove();
    };
  }, [points]);

  return <div className="map" ref={element}></div>;
}

export default function App() {
  const [mode, setMode] = useState('route');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originPlace, setOriginPlace] = useState(null);
  const [destinationPlace, setDestinationPlace] = useState(null);
  const [departure, setDeparture] = useState(defaultDate);
  const [compassTime, setCompassTime] = useState(defaultDate);
  const [duration, setDuration] = useState('');
  const [durationEdited, setDurationEdited] = useState(false);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [recentLocations, setRecentLocations] = useState(() => getRecentLocations());

  const addRecentLocation = (place) => {
    if (!place?.display_name) return;

    setRecentLocations((current) => {
      const next = [
        { display_name: place.display_name, lat: place.lat, lon: place.lon },
        ...current.filter((item) => item.display_name !== place.display_name),
      ];
      const trimmed = next.slice(0, 6);

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      }

      return trimmed;
    });
  };

  const clearRecentLocations = () => {
    setRecentLocations([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const swapLocations = () => {
    setOrigin(destination);
    setDestination(origin);
    setOriginPlace(destinationPlace);
    setDestinationPlace(originPlace);
  };

  const resolvePlace = async (text, selected) => {
    if (selected) return selected;
    const places = await searchPlaces(text);
    if (!places.length) throw new Error(`Could not find “${text}”. Try a nearby landmark or area.`);
    return places[0];
  };

  const submitRoute = async (event) => {
    event.preventDefault();
    if (!origin.trim() || !destination.trim()) return setError('Enter both a starting point and destination.');

    setLoading(true);
    setError('');

    try {
      const start = new Date(departure);
      const from = await resolvePlace(origin, originPlace);
      const to = await resolvePlace(destination, destinationPlace);

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=false`,
      );

      if (!response.ok) throw new Error('Route service unavailable');

      const data = await response.json();
      if (data.code !== 'Ok') throw new Error('No drivable route found');

      const points = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      const routeDuration = Math.max(1, Math.round(data.routes[0].duration / 60));
      const manualDuration = Number(duration);
      const calculatedDuration = durationEdited && manualDuration > 0 ? manualDuration : routeDuration;

      setDuration(calculatedDuration);
      setDurationEdited(durationEdited && manualDuration > 0);

      setReport({
        segments: makeSegments(points, start, calculatedDuration),
        points,
        distance: data.routes[0].distance / 1000,
        start,
        routeName: to.display_name.split(',')[0],
        duration: calculatedDuration,
      });

      addRecentLocation(from);
      addRecentLocation(to);
    } catch (submissionError) {
      setError(submissionError.message || 'Could not calculate this route.');
    } finally {
      setLoading(false);
    }
  };

  const submitCompass = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const position = await new Promise((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (result) => resolve(result.coords),
            () => resolve({ latitude: 40.7128, longitude: -74.006 }),
            { timeout: 2500 },
          );
          return;
        }

        resolve({ latitude: 40.7128, longitude: -74.006 });
      });

      const start = new Date(compassTime);
      const sun = sunReading(position.latitude, position.longitude, start);

      setReport({
        segments: [{ bearing: Number(direction), sun, recommendation: recommendation(Number(direction), sun), time: start }],
        points: null,
        distance: 0,
        start,
        routeName: 'your route',
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setReport(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const valid = report?.segments.filter((segment) => segment.recommendation.side !== 'dark') || [];
  const dominant =
    valid.filter((segment) => segment.recommendation.side === 'LEFT').length >=
    valid.filter((segment) => segment.recommendation.side === 'RIGHT').length
      ? 'LEFT'
      : 'RIGHT';
  const share = valid.length ? valid.filter((segment) => segment.recommendation.side === dominant).length / valid.length : 0;
  const first = report?.segments[0];
  const last = report?.segments[report?.segments.length - 1];
  const dark = Boolean(report && valid.length === 0);
  const bestSeat = dark ? null : share >= 0.7 || report?.duration < 10 ? dominant : first?.recommendation.side;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="ShadeRoute home">
          <span className="brand-mark">☼</span>
          <span>ShadeRoute</span>
        </a>
        <span className="status-chip"><span className="status-dot"></span> Pure sun math — no weather guesswork</span>
      </header>

      <section className="intro">
        <p className="eyebrow">Your window-side navigator</p>
        <h1>
          Catch the shade.<br />
          <em>Skip the glare.</em>
        </h1>
        <p className="intro-copy">Sit on the shady side of your bus or car by matching your route to the sun's path.</p>
      </section>

      <section className="planner panel" aria-labelledby="planner-title">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Plan a journey</p>
            <h2 id="planner-title">Where are you headed?</h2>
          </div>
          <span className="step-badge">01 / 01</span>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="Travel mode">
          <button className={`mode-tab ${mode === 'route' ? 'active' : ''}`} onClick={() => setMode('route')} role="tab" aria-selected={mode === 'route'}>
            Route planner
          </button>
          <button className={`mode-tab ${mode === 'compass' ? 'active' : ''}`} onClick={() => setMode('compass')} role="tab" aria-selected={mode === 'compass'}>
            I know my direction
          </button>
        </div>

        {mode === 'route' ? (
          <form className="form-grid" onSubmit={submitRoute}>
            <LocationField
              label="Starting point"
              name="origin"
              placeholder="e.g. Union Station, Chicago"
              value={origin}
              setValue={setOrigin}
              setPlace={setOriginPlace}
              recentLocations={recentLocations}
              onClearRecent={clearRecentLocations}
              onSwap={swapLocations}
              onSelectRecent={(place) => {
                setOrigin(place.display_name);
                setOriginPlace(place);
              }}
            />

            <div className="route-connector">
              <button type="button" className="swap-btn" onClick={swapLocations} aria-label="Swap starting point and destination" title="Swap locations">⇅</button>
            </div>

            <LocationField
              label="Destination"
              name="destination"
              placeholder="e.g. Navy Pier, Chicago"
              value={destination}
              setValue={setDestination}
              setPlace={setDestinationPlace}
              recentLocations={recentLocations}
              onClearRecent={clearRecentLocations}
              onSwap={swapLocations}
              onSelectRecent={(place) => {
                setDestination(place.display_name);
                setDestinationPlace(place);
              }}
            />

            <div className="field">
              <label htmlFor="departure">Departure</label>
              <input id="departure" type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="duration">
                Expected duration <span className="optional">auto-estimated</span>
              </label>
              <div className="unit-input">
                <input
                  id="duration"
                  type="number"
                  min="1"
                  max="1440"
                  value={duration}
                  placeholder="After route"
                  onChange={(event) => {
                    setDuration(event.target.value);
                    setDurationEdited(true);
                  }}
                />
                <span>min</span>
              </div>
            </div>

            <SubmitButton loading={loading} />
          </form>
        ) : (
          <form className="form-grid compass-form" onSubmit={submitCompass}>
            <div className="field">
              <label htmlFor="direction">Traveling roughly</label>
              <select id="direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
                {[
                  ['0', 'North'],
                  ['45', 'North-east'],
                  ['90', 'East'],
                  ['135', 'South-east'],
                  ['180', 'South'],
                  ['225', 'South-west'],
                  ['270', 'West'],
                  ['315', 'North-west'],
                ].map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="compass-time">At this time</label>
              <input id="compass-time" type="datetime-local" value={compassTime} onChange={(event) => setCompassTime(event.target.value)} required />
            </div>

            <SubmitButton loading={loading} />
          </form>
        )}

        <p className="form-note"><span>✦</span> Cloud cover doesn't affect the calculation. This is pure sun geometry.</p>
        {error && <p className="form-note error-note" role="alert">{error}</p>}
      </section>

      {report && (
        <Result
          report={report}
          dark={dark}
          dominant={dominant}
          share={share}
          bestSeat={bestSeat}
          first={first}
          last={last}
          reset={reset}
        />
      )}

      <footer>
        <span>Built for window-seat optimists</span>
        <span>Data: OpenStreetMap · OSRM · SunCalc</span>
      </footer>
    </main>
  );
}

function SubmitButton({ loading }) {
  return (
    <button className="primary-btn" type="submit" disabled={loading}>
      <span>{loading ? 'Reading the road…' : 'Find my shade'}</span>
      <span className="button-arrow">↗</span>
    </button>
  );
}

function Result({ report, dark, dominant, share, bestSeat, first, last, reset }) {
  const timeline = report.segments || [];
  const rideTone = dark ? 'Night journey' : bestSeat === 'LEFT' ? 'Stay left for shade' : 'Stay right for shade';

  return (
    <section className="result-section" aria-live="polite">
      <div className="result-head">
        <div>
          <p className="section-kicker">Your shade report</p>
          <h2>
            {dark ? 'It’s dark out there.' : share >= 0.7 || report.duration < 10 ? `Sit on the ${dominant.toLowerCase()} side.` : 'The shade changes on the way.'}
          </h2>
          <p className="result-summary">
            {dark
              ? 'No sun exposure expected for this journey.'
              : `The sun will be on your ${dominant === 'LEFT' ? 'right' : 'left'} for most of ${report.routeName} (${formatTime(report.start)} – ${formatTime(last.time)}).`}
          </p>
        </div>

        <div className="sun-status">
          {dark ? 'Night journey' : `${formatDirection(first.sun.azimuth)} sun · ${Math.round(first.sun.altitude)}° high`}
        </div>
      </div>

      <div className={`seat-visual panel ${bestSeat === 'RIGHT' ? 'sun-left' : ''}`}>
        <div className="visual-label left-label">LEFT</div>
        <div className="visual-label right-label">RIGHT</div>
        <div className="sun-orbit"><span className="sun-glyph">☼</span></div>

        <div className="vehicle" aria-label="Top-down view of a vehicle">
          <div className="windshield"></div>
          <div className="seat-row front"><i></i><i></i></div>
          <div className="aisle"></div>
          {[1, 2, 3].map((row) => (
            <div className="seat-row" key={row}><i></i><i></i></div>
          ))}
          <div className="seat-row back"><i></i><i></i></div>
        </div>

        <div className="seat-callout">
          <span className="callout-line"></span>
          <strong>{dark ? 'Any seat will do' : `Best shaded seat · ${bestSeat}`}</strong>
        </div>
      </div>

      <div className="metrics">
        <div>
          <span className="metric-label">Sun direction</span>
          <strong>{dark ? 'Below horizon' : `${formatDirection(first.sun.azimuth)} · ${Math.round(first.sun.azimuth)}°`}</strong>
        </div>
        <div>
          <span className="metric-label">Sun altitude</span>
          <strong>{dark ? '0°' : `${Math.round(first.sun.altitude)}°`}</strong>
        </div>
        <div>
          <span className="metric-label">Route length</span>
          <strong>{Math.round(report.distance)} km</strong>
        </div>
      </div>

      <div className="details-panel">
        <div className="details-header">
          <span>Shade breakdown</span>
          <strong>{rideTone}</strong>
        </div>

        <div className="timeline">
          {timeline.map((segment, index) => {
            const label = segment.recommendation.side === 'dark' ? 'Dark' : segment.recommendation.side;
            const tone = label === 'LEFT' ? 'left' : label === 'RIGHT' ? 'right' : 'minimal';
            const detailText = segment.recommendation.side === 'dark' ? 'No direct sun' : `Best on the ${label.toLowerCase()} side`;

            return (
              <div className="timeline-item" key={`${segment.time}-${index}`}>
                <time>{formatTime(segment.time)}</time>
                <div className="timeline-copy">
                  <strong>{detailText}</strong>
                  <span>{segment.recommendation.sunSide}</span>
                </div>
                <div className={`timeline-side ${tone}`}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {report.points && <MapPreview points={report.points} />}

      <button type="button" className="secondary-btn" onClick={reset}>Plan another route</button>
    </section>
  );
}
