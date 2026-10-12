import { formatDirection, formatTime } from '../utils/format.js';
import MapPreview from './MapPreview.jsx';

export default function Result({
  report,
  dark,
  dominant,
  share,
  bestSeat,
  first,
  last,
  reset,
  onReturnTrip,
}) {
  const timeline = report.segments || [];
  const rideTone = dark
    ? 'Night journey'
    : bestSeat === 'LEFT'
      ? 'Stay left for shade'
      : 'Stay right for shade';

  return (
    <section className="result-section" aria-live="polite">
      <div className="result-head">
        <div>
          <p className="section-kicker">Your shade report</p>
          <h2>
            {dark
              ? "It's dark out there."
              : share >= 0.7 || report.duration < 10
                ? `Sit on the ${dominant.toLowerCase()} side.`
                : 'The shade changes on the way.'}
          </h2>
          <p className="result-summary">
            {dark
              ? 'No sun exposure expected for this journey.'
              : `The sun will be on your ${dominant === 'LEFT' ? 'right' : 'left'} for most of ${report.routeName} (${formatTime(report.start)} – ${formatTime(last.time)}).`}
          </p>
        </div>

        <div className="sun-status">
          {dark
            ? 'Night journey'
            : `${formatDirection(first.sun.azimuth)} sun · ${Math.round(first.sun.altitude)}° high`}
        </div>
      </div>

      <div
        className={`seat-visual panel ${bestSeat === 'RIGHT' ? 'sun-left' : ''}`}
      >
        <div className="visual-label left-label">LEFT</div>
        <div className="visual-label right-label">RIGHT</div>
        <div className="sun-orbit">
          <span className="sun-glyph">☼</span>
        </div>

        <div className="vehicle" aria-label="Top-down view of a vehicle">
          <div className="windshield"></div>
          <div className="seat-row front">
            <i></i>
            <i></i>
          </div>
          <div className="aisle"></div>
          {[1, 2, 3].map((row) => (
            <div className="seat-row" key={row}>
              <i></i>
              <i></i>
            </div>
          ))}
          <div className="seat-row back">
            <i></i>
            <i></i>
          </div>
        </div>

        <div className="seat-callout">
          <span className="callout-line"></span>
          <strong>
            {dark
              ? 'Any seat will do'
              : `Best shaded seat · ${bestSeat}`}
          </strong>
        </div>
      </div>

      <div className="metrics">
        <div>
          <span className="metric-label">Sun direction</span>
          <strong>
            {dark
              ? 'Below horizon'
              : `${formatDirection(first.sun.azimuth)} · ${Math.round(first.sun.azimuth)}°`}
          </strong>
        </div>
        <div>
          <span className="metric-label">Sun altitude</span>
          <strong>
            {dark ? '0°' : `${Math.round(first.sun.altitude)}°`}
          </strong>
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
            const label =
              segment.recommendation.side === 'dark'
                ? 'Dark'
                : segment.recommendation.side;
            const tone =
              label === 'LEFT'
                ? 'left'
                : label === 'RIGHT'
                  ? 'right'
                  : 'minimal';
            const detailText =
              segment.recommendation.side === 'dark'
                ? 'No direct sun'
                : `Best on the ${label.toLowerCase()} side`;

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

      <div className="result-actions">
        {onReturnTrip && report.points && (
          <button
            type="button"
            className="secondary-btn return-trip-btn"
            onClick={onReturnTrip}
          >
            ↩ Check the return trip
          </button>
        )}
        <button type="button" className="secondary-btn" onClick={reset}>
          Plan another route
        </button>
      </div>
    </section>
  );
}

