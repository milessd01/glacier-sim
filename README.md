# Glacier Mission Control

A graphics-free, data-driven dashboard for monitoring glacier health across multiple Alaska glaciers. It pulls live weather data from Open-Meteo, runs a mass-balance model, and visualizes trends over the last 30 days.

## Features

- **Live weather**: temperature, wind speed, precipitation, and timestamp with timezone.
- **Multi-glacier support**: switch between Mendenhall, Hubbard, and Columbia with isolated histories and baselines.
- **Mass balance model**: daily mass change, 7-day rolling trend, glacier state badge, and health index.
- **Simulation controls**: advance the model by 1, 7, or 30 days using Open-Meteo daily forecasts (with a deterministic simulated fallback).
- **Charts**: 30‑day health index line chart and daily mass change bar chart.
- **Daily summary**: concise, natural-language explanation of today’s glacier behavior.
- **Alert system**: integrity, loss, melt, acceleration, and data reliability badges.
- **Time-to-loss projection**: estimate to reach Health Index 40 with confidence notes.
- **Model confidence**: High/Medium/Low indicator based on data freshness and volatility.

## Data Sources

- **Open‑Meteo API** (no API key required): https://open-meteo.com/
- **National Weather Service API** (no API key required): https://www.weather.gov/documentation/services-web-api
- Coordinates are configured per glacier in `src/main.js` and used for all API requests and simulations.
- Included glaciers: Mendenhall (Juneau), Hubbard (Yakutat Bay), Columbia (Prince William Sound).

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
