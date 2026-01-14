# Glacier Mission Control

A graphics-free, data-driven dashboard for monitoring glacier health. It pulls live weather data from Open-Meteo for Mendenhall Glacier (Alaska), runs a mass-balance model, and visualizes trends over the last 30 days.

## Features

- **Live weather**: temperature, wind speed, precipitation, and timestamp with timezone.
- **Mass balance model**: daily mass change, 7-day rolling trend, glacier state badge, and health index.
- **Simulation controls**: advance the model by 1, 7, or 30 days using Open-Meteo daily forecasts (with a deterministic simulated fallback).
- **Charts**: 30‑day health index line chart and daily mass change bar chart.
- **Daily summary**: concise, natural‑language explanation of today’s glacier behavior.

## Data Sources

- **Open‑Meteo API** (no API key required): https://open-meteo.com/
- Coordinates: **58.4N, 134.4W** (Mendenhall Glacier)

## Model

Daily mass change is calculated as:

```
dailyChange =
  (precipitation × accumulationRate) -   // snowfall only when temp ≤ 1°C
  (max(0, temperature) × meltRate) -      // melt only when temp > 0°C
  (windSpeed × sublimationRate)
```

Default parameters:

- accumulationRate = 0.1
- meltRate = 0.05
- sublimationRate = 0.01

Glacier state:

- **Advancing** when 7-day trend > 0.1
- **Stable** when between -0.1 and 0.1
- **Receding** when 7‑day trend < -0.1

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

## Project Structure

```
src/
  main.js       # App bootstrap
  model.js      # Glacier mass balance + simulation
  weather.js    # Open-Meteo integration + fallback
  ui.js         # Dashboard UI + charts
  styles.css    # Layout + styling
```
