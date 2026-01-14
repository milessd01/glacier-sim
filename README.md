# Glacier Simulator

A real-time glacier recession and growth simulator that visually models Mendenhall Glacier (Alaska) using live weather data. The simulation tracks daily conditions and predicts whether the glacier is growing or receding based on real temperature, snowfall, and wind data.

## Features

- **3D Visualization**: Interactive Three.js scene with realistic glacier mesh using noise-based displacement
- **Real-Time Weather**: Fetches live weather data from Open-Meteo API (no API key required)
- **Mass Balance Physics**: Calculates glacier growth/recession based on temperature, precipitation, and wind
- **Interactive Controls**: Adjust simulation speed, visual exaggeration, and toggle between real/mock weather
- **Visual Feedback**: Clear indicators showing glacier state (Advancing/Stable/Receding) and mass index

## Installation

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deployment to GitHub Pages

### Automatic Deployment (Recommended)

The repository includes a GitHub Actions workflow that automatically deploys to GitHub Pages when you push to the `main` branch.

1. Push your code to GitHub
2. Go to your repository Settings → Pages
3. Under "Source", select "GitHub Actions"
4. The workflow will automatically build and deploy on every push to `main`

### Manual Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Install `gh-pages` (if not already installed):
   ```bash
   npm install --save-dev gh-pages
   ```

3. Add a deploy script to `package.json`:
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

## How It Works

### Mass Balance Calculation

The simulator calculates daily mass change using:

```
dailyMassChange = 
  (precipitation × 0.1) -        // Accumulation (snow → ice)
  (max(0, temperature) × 0.05) - // Melt (positive temps only)
  (windSpeed × 0.01)             // Sublimation loss
```

### Glacier States

- **Advancing**: Daily change > 0.1
- **Stable**: Daily change between -0.1 and 0.1
- **Receding**: Daily change < -0.1

### Weather Data

The app fetches weather data for Mendenhall Glacier coordinates (58.4°N, 134.6°W) from the Open-Meteo API. If the API is unavailable, it falls back to mock weather data.

## Technologies

- **Vite**: Build tool and dev server
- **Three.js**: 3D graphics and rendering
- **Simplex Noise**: Procedural terrain generation
- **Open-Meteo API**: Free weather data (no API key required)

## Project Structure

```
glacier-sim/
├── index.html              # Main HTML file
├── src/
│   ├── main.js            # Application entry point
│   ├── glacier.js         # Three.js scene and physics
│   ├── weather.js         # Weather API integration
│   ├── ui.js              # UI controls and display
│   └── styles.css         # Styling
├── vite.config.js         # Vite configuration
└── package.json           # Dependencies and scripts
```

## License

MIT
