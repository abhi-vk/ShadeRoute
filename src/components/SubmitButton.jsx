export default function SubmitButton({ loading }) {
  return (
    <button className="primary-btn" type="submit" disabled={loading}>
      <span>{loading ? 'Reading the road…' : 'Find my shade'}</span>
      <span className="button-arrow">↗</span>
    </button>
  );
}

