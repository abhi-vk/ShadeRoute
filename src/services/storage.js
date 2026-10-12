const STORAGE_KEY = 'shaderoute-recent-locations';
const DARK_MODE_KEY = 'shaderoute-dark-mode';

export function getRecentLocations() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && item.display_name)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentLocations(locations) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  }
}

export function clearStoredLocations() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getDarkMode() {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored !== null) return stored === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

export function saveDarkMode(enabled) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DARK_MODE_KEY, String(enabled));
  }
}

