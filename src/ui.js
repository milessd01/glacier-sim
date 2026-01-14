/**
 * UI module - Handles all overlay controls and data display
 */

export class UI {
    constructor() {
        this.elements = {};
        this.init();
    }

    /**
     * Initialize UI elements and event listeners
     */
    init() {
        // Info display elements
        this.elements.temperature = document.getElementById('temperature');
        this.elements.windSpeed = document.getElementById('wind-speed');
        this.elements.precipitation = document.getElementById('precipitation');
        this.elements.glacierState = document.getElementById('glacier-state');
        this.elements.massIndex = document.getElementById('mass-index');
        this.elements.dailyChange = document.getElementById('daily-change');
        this.elements.sevenDayTrend = document.getElementById('seven-day-trend');
        this.elements.weatherSource = document.getElementById('weather-source');
        this.elements.lastUpdated = document.getElementById('last-updated');
        this.elements.staleWarning = document.getElementById('stale-warning');
        
        // Control elements
        this.elements.speedSlider = document.getElementById('speed-slider');
        this.elements.speedValue = document.getElementById('speed-value');
        this.elements.exaggerationSlider = document.getElementById('exaggeration-slider');
        this.elements.exaggerationValue = document.getElementById('exaggeration-value');
        this.elements.weatherToggle = document.getElementById('weather-toggle');
        this.elements.refreshWeather = document.getElementById('refresh-weather');
        this.elements.resetGlacier = document.getElementById('reset-glacier');
        
        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Speed slider
        this.elements.speedSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.speedValue.textContent = value.toFixed(1);
            this._onSpeedChange?.(value);
        });
        
        // Exaggeration slider
        this.elements.exaggerationSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.exaggerationValue.textContent = value.toFixed(1);
            this._onExaggerationChange?.(value);
        });
        
        // Weather toggle
        this.elements.weatherToggle.addEventListener('click', () => {
            this._onWeatherToggle?.();
        });
        
        // Refresh weather
        this.elements.refreshWeather.addEventListener('click', () => {
            this._onRefreshWeather?.();
        });
        
        // Reset glacier
        this.elements.resetGlacier.addEventListener('click', () => {
            this._onResetGlacier?.();
        });
    }

    /**
     * Update weather display
     */
    updateWeather(weather, source, lastUpdated) {
        this.elements.temperature.textContent = weather.temperature.toFixed(1);
        this.elements.windSpeed.textContent = weather.windSpeed.toFixed(1);
        this.elements.precipitation.textContent = weather.precipitation.toFixed(2);
        
        // Update weather source label
        if (source === 'real') {
            this.elements.weatherSource.textContent = 'Real Weather Data';
            this.elements.weatherSource.className = 'weather-label real';
        } else if (source === 'mock') {
            this.elements.weatherSource.textContent = 'Mock Weather Data';
            this.elements.weatherSource.className = 'weather-label mock';
        } else {
            this.elements.weatherSource.textContent = 'Mock Weather (API Failed)';
            this.elements.weatherSource.className = 'weather-label mock-fallback';
        }
        
        // Update last updated timestamp
        if (lastUpdated && this.elements.lastUpdated) {
            const date = new Date(lastUpdated);
            const formattedDate = date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            });
            this.elements.lastUpdated.textContent = `Updated: ${formattedDate}`;
            
            // Check if data is stale (older than 2 hours)
            if (this.elements.staleWarning) {
                const now = new Date();
                const ageHours = (now - date) / (1000 * 60 * 60);
                
                if (ageHours > 2 && source === 'real') {
                    this.elements.staleWarning.style.display = 'block';
                    this.elements.staleWarning.textContent = `⚠️ Stale data (${ageHours.toFixed(1)}h old)`;
                } else {
                    this.elements.staleWarning.style.display = 'none';
                }
            }
        }
    }

    /**
     * Update glacier status display
     */
    updateGlacierStatus(state, massIndex, dailyChange, sevenDayTrend) {
        this.elements.glacierState.textContent = state;
        this.elements.massIndex.textContent = massIndex.toFixed(2);
        
        // Format daily change with sign
        const sign = dailyChange >= 0 ? '+' : '';
        this.elements.dailyChange.textContent = `${sign}${dailyChange.toFixed(2)}`;
        
        // Format 7-day trend with sign
        if (this.elements.sevenDayTrend && sevenDayTrend !== undefined) {
            const trendSign = sevenDayTrend >= 0 ? '+' : '';
            this.elements.sevenDayTrend.textContent = `${trendSign}${sevenDayTrend.toFixed(2)}`;
        }
        
        // Update state badge color
        this.elements.glacierState.className = 'state-badge';
        if (state === 'Advancing') {
            this.elements.glacierState.classList.add('advancing');
        } else if (state === 'Receding') {
            this.elements.glacierState.classList.add('receding');
        } else {
            this.elements.glacierState.classList.add('stable');
        }
    }

    /**
     * Update weather toggle button text
     */
    updateWeatherToggleButton(isUsingMock) {
        this.elements.weatherToggle.textContent = isUsingMock 
            ? 'Use Real Weather' 
            : 'Use Mock Weather';
    }

    // Callback setters
    set onSpeedChange(callback) {
        this._onSpeedChange = callback;
    }

    set onExaggerationChange(callback) {
        this._onExaggerationChange = callback;
    }

    set onWeatherToggle(callback) {
        this._onWeatherToggle = callback;
    }

    set onRefreshWeather(callback) {
        this._onRefreshWeather = callback;
    }

    set onResetGlacier(callback) {
        this._onResetGlacier = callback;
    }
}
