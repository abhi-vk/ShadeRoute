# ShadeRoute

ShadeRoute helps bus and car passengers choose the cooler side of a vehicle. It compares the direction of travel with the sun's position to recommend a shaded seat.

## Live Demo

[Open ShadeRoute on GitHub Pages](https://abhi-vk.github.io/Shadow_App/)

## Features

- Search origin and destination with OpenStreetMap Nominatim
- Calculate road-following routes with the OSRM routing API
- Calculate solar azimuth and altitude with SunCalc
- Recommend sitting on the LEFT or RIGHT side of the vehicle
- Show a timeline when the road bends or the sun position changes
- Support direction-only planning when a full route is not needed
- Handle nighttime, short trips, and overhead sun
- Responsive mobile-first interface with a Leaflet route map

ShadeRoute is a geometry-based tool. It does not use weather data, so cloud cover is not part of the calculation.

## Run Locally

No build step or package installation is required.

```powershell
python -m http.server 4173
```

Open <http://localhost:4173> in a browser.

## Data Sources

- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) for place search
- [OSRM](https://project-osrm.org/) for driving routes
- [SunCalc](https://github.com/mourner/suncalc) for sun position calculations
- [Leaflet](https://leafletjs.com/) and OpenStreetMap tiles for the map

## Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that deploys the static site to GitHub Pages whenever changes are pushed to `main`.
