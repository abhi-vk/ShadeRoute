const PHOTON_URL =
  import.meta.env.VITE_PHOTON_URL || 'https://photon.komoot.io';
const NOMINATIM_URL =
  import.meta.env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

export async function searchPlaces(query, signal) {
  const encoded = encodeURIComponent(query);

  const photon = fetch(
    `${PHOTON_URL}/api/?q=${encoded}&limit=8&lang=en`,
    { signal },
  ).then(async (response) => {
    if (!response.ok) throw new Error();
    const data = await response.json();
    return (data.features || [])
      .map((feature) => {
        const properties = feature.properties || {};
        const address = [
          properties.street,
          properties.city,
          properties.state,
          properties.postcode,
          properties.country,
        ]
          .filter(Boolean)
          .join(', ');
        return {
          display_name: [properties.name, address].filter(Boolean).join(', '),
          lat: feature.geometry.coordinates[1],
          lon: feature.geometry.coordinates[0],
        };
      })
      .filter((place) => place.display_name);
  });

  const nominatim = fetch(
    `${NOMINATIM_URL}/search?format=jsonv2&limit=8&addressdetails=1&namedetails=1&q=${encoded}`,
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
  const words = normalizedQuery
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
  const score = (place) => {
    const name = place.display_name.toLowerCase();
    const exactStart = name.startsWith(normalizedQuery) ? 12 : 0;
    const exactPhrase = name.includes(normalizedQuery) ? 6 : 0;
    const matchedWords = words.reduce(
      (total, word) => total + (name.includes(word) ? 2 : 0),
      0,
    );
    return exactStart + exactPhrase + matchedWords;
  };

  return [...unique.values()]
    .sort(
      (a, b) =>
        score(b) - score(a) || a.display_name.localeCompare(b.display_name),
    )
    .slice(0, 8);
}

export async function reverseGeocode(lat, lon, signal) {
  const response = await fetch(
    `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
    { headers: { 'Accept-Language': 'en-IN,en' }, signal },
  );
  if (!response.ok) throw new Error('Reverse geocoding failed');
  const data = await response.json();
  return {
    display_name: data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    lat,
    lon,
  };
}

