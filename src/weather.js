/**
 * Weather module - Fetches real-time weather data from Open-Meteo API
 * Falls back to mock data if API fetch fails
 */

export class Weather {
    constructor() {
        this.latitude = 58.4;
        this.longitude = -134.6;
        this.useMock = false;
        this.debug = false; // Set to true to log raw JSON
        this.currentWeather = {
            temperature: 0,
            windSpeed: 0,
            precipitation: 0,
            lastUpdated: null
        };
        this.mockWeather = {
            temperature: -5,
            windSpeed: 15,
            precipitation: 2,
            lastUpdated: new Date()
        };
    }

    /**
     * Fetch weather data from Open-Meteo API
     */
    async fetchWeather() {
        if (this.useMock) {
            this.currentWeather = { ...this.mockWeather };
            return { ...this.currentWeather, source: 'mock' };
        }

        try {
            const baseUrl = `https://api.open-meteo.com/v1/forecast?latitude=${this.latitude}&longitude=${this.longitude}&current=temperature_2m,wind_speed_10m,precipitation&timezone=auto&wind_speed_unit=kmh&precipitation_unit=mm`;
            // Disable caching by adding timestamp and cache control
            const url = baseUrl + '&_=' + Date.now();
            const response = await fetch(url, { cache: 'no-store' });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Debug logging
            if (this.debug) {
                console.log('Raw weather JSON:', JSON.stringify(data, null, 2));
            }
            
            if (data.current) {
                // Parse timestamp
                const lastUpdated = data.current.time ? new Date(data.current.time) : new Date();
                
                this.currentWeather = {
                    temperature: data.current.temperature_2m || 0,
                    windSpeed: data.current.wind_speed_10m || 0,
                    precipitation: data.current.precipitation || 0,
                    lastUpdated: lastUpdated
                };
                return { ...this.currentWeather, source: 'real' };
            } else {
                throw new Error('Invalid API response format');
            }
        } catch (error) {
            console.warn('Weather fetch failed, using mock data:', error);
            this.currentWeather = { ...this.mockWeather };
            return { ...this.currentWeather, source: 'mock-fallback' };
        }
    }

    /**
     * Toggle between real and mock weather
     */
    toggleMock() {
        this.useMock = !this.useMock;
        return this.fetchWeather();
    }

    /**
     * Get current weather data
     */
    getWeather() {
        return { ...this.currentWeather };
    }

    /**
     * Check if currently using mock data
     */
    isUsingMock() {
        return this.useMock;
    }
    
    /**
     * Enable/disable debug logging
     */
    setDebug(enabled) {
        this.debug = enabled;
    }
}
