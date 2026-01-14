/**
 * Main application entry point
 * Orchestrates scene initialization, animation loop, and module coordination
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PMREMGenerator } from 'three';
import { Glacier } from './glacier.js';
import { Weather } from './weather.js';
import { UI } from './ui.js';

class GlacierSimulator {
    constructor() {
        this.glacier = null;
        this.weather = null;
        this.ui = null;
        
        this.simulationSpeed = 1.0;
        this.lastUpdateTime = 0;
        this.dailyTickInterval = 10; // 10 seconds = 1 simulated day (for demo purposes)
        this.dailyTickAccumulator = 0;
        
        this.init();
    }

    /**
     * Initialize all modules
     */
    async init() {
        // Get container
        const container = document.getElementById('canvas-container');
        
        // Initialize modules
        this.glacier = new Glacier(container);
        this.weather = new Weather();
        this.ui = new UI();
        
        // Set up environment map for realistic reflections
        await this.setupEnvironmentMap();
        
        // Set up UI callbacks
        this.setupUICallbacks();
        
        // Load initial weather
        await this.refreshWeather();
        
        // Process initial daily tick to calculate glacier state
        this.processDailyTick();
        
        // Start animation loop
        this.animate();
    }
    
    /**
     * Set up environment map using RoomEnvironment and PMREMGenerator
     */
    async setupEnvironmentMap() {
        try {
            const pmremGenerator = new PMREMGenerator(this.glacier.renderer);
            pmremGenerator.compileEquirectangularShader();
            
            const environment = new RoomEnvironment();
            const envMap = pmremGenerator.fromScene(environment, 0.04).texture;
            
            // Apply environment map to glacier
            this.glacier.setEnvironmentMap(envMap);
            
            // Cleanup
            environment.dispose();
            pmremGenerator.dispose();
        } catch (error) {
            console.warn('Failed to setup environment map:', error);
            // Continue without environment map - glacier will still render
        }
    }

    /**
     * Set up UI event callbacks
     */
    setupUICallbacks() {
        // Simulation speed
        this.ui.onSpeedChange = (speed) => {
            this.simulationSpeed = speed;
        };
        
        // Exaggeration
        this.ui.onExaggerationChange = (exaggeration) => {
            this.glacier.setExaggeration(exaggeration);
        };
        
        // Weather toggle
        this.ui.onWeatherToggle = async () => {
            const weatherData = await this.weather.toggleMock();
            this.ui.updateWeather(weatherData, weatherData.source, weatherData.lastUpdated);
            this.ui.updateWeatherToggleButton(this.weather.isUsingMock());
        };
        
        // Refresh weather
        this.ui.onRefreshWeather = () => {
            this.refreshWeather();
        };
        
        // Reset glacier
        this.ui.onResetGlacier = () => {
            this.glacier.reset();
            this.updateUI();
        };
    }

    /**
     * Refresh weather data and update UI
     */
    async refreshWeather() {
        const weatherData = await this.weather.fetchWeather();
        this.ui.updateWeather(weatherData, weatherData.source, weatherData.lastUpdated);
        this.ui.updateWeatherToggleButton(this.weather.isUsingMock());
    }

    /**
     * Update UI with current glacier state
     */
    updateUI() {
        const state = this.glacier.getState();
        this.ui.updateGlacierStatus(
            state.state,
            state.massIndex,
            state.dailyChange,
            state.sevenDayTrend
        );
    }

    /**
     * Process daily tick (mass balance update)
     */
    processDailyTick() {
        const weather = this.weather.getWeather();
        this.glacier.updateMassBalance(weather);
        this.updateUI();
    }

    /**
     * Main animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const currentTime = performance.now() / 1000; // Convert to seconds
        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;
        
        // Apply simulation speed
        const scaledDeltaTime = deltaTime * this.simulationSpeed;
        
        // Accumulate time for daily ticks
        this.dailyTickAccumulator += scaledDeltaTime;
        
        // Process daily tick if enough time has passed
        if (this.dailyTickAccumulator >= this.dailyTickInterval) {
            this.processDailyTick();
            this.dailyTickAccumulator = 0;
        }
        
        // Update glacier animation
        this.glacier.update(scaledDeltaTime);
        
        // Render
        this.glacier.render();
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new GlacierSimulator();
    });
} else {
    new GlacierSimulator();
}
