import { useState } from 'react';
import {
  getRecentLocations,
  saveRecentLocations,
  clearStoredLocations,
} from '../services/storage.js';

export function useRecentLocations() {
  const [locations, setLocations] = useState(() => getRecentLocations());

  const add = (place) => {
    if (!place?.display_name) return;
    setLocations((current) => {
      const next = [
        { display_name: place.display_name, lat: place.lat, lon: place.lon },
        ...current.filter((item) => item.display_name !== place.display_name),
      ].slice(0, 6);
      saveRecentLocations(next);
      return next;
    });
  };

  const clear = () => {
    setLocations([]);
    clearStoredLocations();
  };

  return { locations, add, clear };
}

