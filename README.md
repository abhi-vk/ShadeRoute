# ShadeRoute

ShadeRoute helps bus and car passengers choose the cooler side of a vehicle. It compares the direction of travel with the sun's position to recommend a shaded seat.

## Live Demo

[Open ShadeRoute on GitHub Pages](https://abhi-vk.github.io/ShadeRoute/)

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
The frontend is built with React and Vite. GitHub Actions installs dependencies, creates the production build, and deploys the generated `dist` directory to GitHub Pages.

## Run Locally

Install Node.js 20 or newer, then install dependencies and start the Vite development server.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite in a browser.

## Run with Docker

This project is also containerized so it can run the same way on any machine with Docker installed.

See the complete [Docker guide](docs/DOCKER.md) for building from GitHub, publishing to Docker Hub, and running the published image.

```powershell
docker build -t shaderoute .
docker run --rm -p 5173:5173 shaderoute
```

Then open http://localhost:5173 in your browser.

## Data Sources

- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) for place search
- [OSRM](https://project-osrm.org/) for driving routes
- [SunCalc](https://github.com/mourner/suncalc) for sun position calculations
- [Leaflet](https://leafletjs.com/) and OpenStreetMap tiles for the map

## Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. On every push to `main`, it installs dependencies with `npm ci`, runs `npm run build`, uploads `dist`, and deploys the artifact to GitHub Pages.
