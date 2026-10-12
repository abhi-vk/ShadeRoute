import { useEffect, useMemo, useState } from 'react';
import LocationField from './components/LocationField.jsx';
import Result from './components/Result.jsx';
import SubmitButton from './components/SubmitButton.jsx';
import { searchPlaces, reverseGeocode } from './services/geocoding.js';
import { sunReading, recommendation, makeSegments } from './services/sun.js';
import { getDarkMode, saveDarkMode } from './services/storage.js';
import { useRecentLocations } from './hooks/useRecentLocations.js';

const OSRM_URL =
  import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';

const defaultDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

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
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [darkMode, setDarkMode] = useState(() => getDarkMode());

  const { locations: recentLocations, add: addRecentLocation, clear: clearRecentLocations } =
    useRecentLocations();

  // Apply dark-mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveDarkMode(darkMode);
  }, [darkMode]);

  const swapLocations = () => {
    setOrigin(destination);
    setDestination(origin);
    setOriginPlace(destinationPlace);
    setDestinationPlace(originPlace);
  };

  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    setError('');

    try {
      const coords = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (result) => resolve(result.coords),
          (err) => reject(new Error(err.code === 1
            ? 'Location access denied. Please allow location permissions.'
            : 'Could not determine your location. Please enter it manually.')),
          { timeout: 8000, enableHighAccuracy: false },
        );
      });

      const place = await reverseGeocode(coords.latitude, coords.longitude);
      setOrigin(place.display_name);
      setOriginPlace(place);
    } catch (locError) {
      setError(locError.message);
    } finally {
      setLocating(false);
    }
  };

  const resolvePlace = async (text, selected) => {
    if (selected) return selected;
    const places = await searchPlaces(text);
    if (!places.length)
      throw new Error(`Could not find "${text}". Try a nearby landmark or area.`);
    return places[0];
  };

  const submitRoute = async (event) => {
    event.preventDefault();
    if (!origin.trim() || !destination.trim())
      return setError('Enter both a starting point and destination.');

    setLoading(true);
    setError('');

    try {
      const start = new Date(departure);
      const from = await resolvePlace(origin, originPlace);
      const to = await resolvePlace(destination, destinationPlace);

      const response = await fetch(
        `${OSRM_URL}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=false`,
      );

      if (!response.ok) throw new Error('Route service unavailable');

      const data = await response.json();
      if (data.code !== 'Ok') throw new Error('No drivable route found');

      const points = data.routes[0].geometry.coordinates.map(([lon, lat]) => [
        lat,
        lon,
      ]);
      const routeDuration = Math.max(
        1,
        Math.round(data.routes[0].duration / 60),
      );
      const manualDuration = Number(duration);
      const calculatedDuration =
        durationEdited && manualDuration > 0 ? manualDuration : routeDuration;

      setDuration(calculatedDuration);
      setDurationEdited(durationEdited && manualDuration > 0);

      setReport({
        segments: makeSegments(points, start, calculatedDuration),
        points,
        distance: data.routes[0].distance / 1000,
        start,
        routeName: to.display_name.split(',')[0],
        duration: calculatedDuration,
        from,
        to,
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
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported. Cannot determine sun position without your location.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (result) => resolve({ coords: result.coords, fallback: false }),
          () => resolve({ coords: { latitude: 40.7128, longitude: -74.006 }, fallback: true }),
          { timeout: 5000 },
        );
      });

      if (position.fallback) {
        setError('Could not get your location — showing results for New York City. Enter a route for accurate results.');
      }

      const start = new Date(compassTime);
      const sun = sunReading(
        position.coords.latitude,
        position.coords.longitude,
        start,
      );

      setReport({
        segments: [
          {
            bearing: Number(direction),
            sun,
            recommendation: recommendation(Number(direction), sun),
            time: start,
          },
        ],
        points: null,
        distance: 0,
        start,
        routeName: 'your route',
        duration: 5,
        from: null,
        to: null,
      });
    } catch (compassError) {
      setError(compassError.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setReport(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReturnTrip = () => {
    if (!report?.from || !report?.to) return;

    const arrivalTime = new Date(
      report.start.getTime() + report.duration * 60000,
    );
    arrivalTime.setMinutes(
      arrivalTime.getMinutes() - arrivalTime.getTimezoneOffset(),
    );

    setOrigin(destination);
    setDestination(origin);
    setOriginPlace(report.to);
    setDestinationPlace(report.from);
    setDeparture(arrivalTime.toISOString().slice(0, 16));
    setDuration('');
    setDurationEdited(false);
    setReport(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Auto-submit after a tick so the state updates propagate
    setTimeout(() => {
      document.querySelector('.planner form')?.requestSubmit();
    }, 100);
  };

  // Memoised derived values — only recompute when report changes
  const { valid, dominant, share, first, last, dark, bestSeat } = useMemo(() => {
    if (!report) return { valid: [], dominant: 'LEFT', share: 0, first: null, last: null, dark: false, bestSeat: null };

    const v = report.segments.filter((s) => s.recommendation.side !== 'dark');
    const d =
      v.filter((s) => s.recommendation.side === 'LEFT').length >=
      v.filter((s) => s.recommendation.side === 'RIGHT').length
        ? 'LEFT'
        : 'RIGHT';
    const sh = v.length
      ? v.filter((s) => s.recommendation.side === d).length / v.length
      : 0;
    const f = report.segments[0];
    const l = report.segments[report.segments.length - 1];
    const dk = v.length === 0;
    const bs = dk ? null : sh >= 0.7 || report.duration < 10 ? d : f?.recommendation.side;

    return { valid: v, dominant: d, share: sh, first: f, last: l, dark: dk, bestSeat: bs };
  }, [report]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="ShadeRoute home">
          <span className="brand-mark">☼</span>
          <span>ShadeRoute</span>
        </a>
        <div className="topbar-right">
          <button
            type="button"
            className="dark-toggle"
            onClick={() => setDarkMode((v) => !v)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? '☀' : '☽'}
          </button>
          <span className="status-chip">
            <span className="status-dot"></span> Pure sun math — no weather
            guesswork
          </span>
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">Your window-side navigator</p>
        <h1>
          Catch the shade.
          <br />
          <em>Skip the glare.</em>
        </h1>
        <p className="intro-copy">
          Sit on the shady side of your bus or car by matching your route to
          the sun's path.
        </p>
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
          <button
            className={`mode-tab ${mode === 'route' ? 'active' : ''}`}
            onClick={() => setMode('route')}
            role="tab"
            aria-selected={mode === 'route'}
          >
            Route planner
          </button>
          <button
            className={`mode-tab ${mode === 'compass' ? 'active' : ''}`}
            onClick={() => setMode('compass')}
            role="tab"
            aria-selected={mode === 'compass'}
          >
            I know my direction
          </button>
        </div>

        {mode === 'route' ? (
          <form className="form-grid" onSubmit={submitRoute}>
            <div className="origin-row">
              <LocationField
                label="Starting point"
                name="origin"
                placeholder="e.g. Union Station, Chicago"
                value={origin}
                setValue={setOrigin}
                setPlace={setOriginPlace}
                recentLocations={recentLocations}
                onClearRecent={clearRecentLocations}
                onSelectRecent={(place) => {
                  setOrigin(place.display_name);
                  setOriginPlace(place);
                }}
              />
              <button
                type="button"
                className="locate-btn"
                onClick={useMyLocation}
                disabled={locating}
                aria-label="Use my current location"
                title="Use my current location"
              >
                {locating ? '⟳' : '◎'}
              </button>
            </div>

            <div className="route-connector">
              <button
                type="button"
                className="swap-btn"
                onClick={swapLocations}
                aria-label="Swap starting point and destination"
                title="Swap locations"
              >
                ⇅
              </button>
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
              onSelectRecent={(place) => {
                setDestination(place.display_name);
                setDestinationPlace(place);
              }}
            />

            <div className="field">
              <label htmlFor="departure">Departure</label>
              <input
                id="departure"
                type="datetime-local"
                value={departure}
                onChange={(event) => setDeparture(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="duration">
                Expected duration{' '}
                <span className="optional">auto-estimated</span>
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
              <select
                id="direction"
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
              >
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
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="compass-time">At this time</label>
              <input
                id="compass-time"
                type="datetime-local"
                value={compassTime}
                onChange={(event) => setCompassTime(event.target.value)}
                required
              />
            </div>

            <SubmitButton loading={loading} />
          </form>
        )}

        <p className="form-note">
          <span>✦</span> Cloud cover doesn't affect the calculation. This is
          pure sun geometry.
        </p>
        {error && (
          <p className="form-note error-note" role="alert">
            {error}
          </p>
        )}
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
          onReturnTrip={report.from && report.to ? handleReturnTrip : null}
        />
      )}

      <footer>
        <span>Built for window-seat optimists</span>
        <span>Data: OpenStreetMap · OSRM · SunCalc</span>
      </footer>
    </main>
  );
}
