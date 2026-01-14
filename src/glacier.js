/**
 * Glacier module - Three.js scene, mesh, animation, and mass balance physics
 * Photo-matched glacier scene with realistic composition
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

export class Glacier {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.glacierMesh = null;
        this.lakeMesh = null;
        this.iceEdgeMesh = null;
        this.valleyWalls = [];
        this.backgroundTexture = null;
        this.noise2D = createNoise2D();
        
        // Mass balance parameters
        this.massIndex = 100.0;
        this.dailyChange = 0.0;
        this.sevenDayTrend = 0.0;
        this.state = 'Stable';
        
        // 7-day rolling average for mass balance
        this.massHistory = [];
        this.maxHistoryLength = 7;
        
        // Animation parameters
        this.time = 0;
        this.noiseOffset = 0;
        this.exaggeration = 1.0;
        this.lastVisualUpdate = 0;
        this.visualUpdateInterval = 0.1;
        
        // Physics constants
        this.accumulationRate = 0.1;
        this.meltRate = 0.05;
        this.sublimationRate = 0.01;
        
        // State thresholds
        this.advancingThreshold = 0.1;
        this.recedingThreshold = -0.1;
        
        // Height tracking for color variation
        this.minHeight = 0;
        this.maxHeight = 0;
        
        this.init();
    }

    /**
     * Initialize Three.js scene, camera, renderer, and controls
     */
    async init() {
        // Load background image
        await this.loadBackgroundImage();
        
        // Camera setup - wide FOV for cinematic view
        this.camera = new THREE.PerspectiveCamera(
            50, // Wide FOV (45-60 range)
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Position camera so glacier tongue sits mid-frame with lake foreground visible
        this.camera.position.set(0, 15, 45);
        this.camera.lookAt(0, 5, 0);
        
        // Renderer setup with physically correct settings
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0; // Adjust so ice looks bright but not blown out
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
        
        // Orbit controls - constrained to maintain composition
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 5, 0); // Target at glacier center
        this.controls.minDistance = 25;
        this.controls.maxDistance = 120;
        this.controls.maxPolarAngle = Math.PI / 2.3; // Prevent going below horizon
        this.controls.minPolarAngle = Math.PI / 4; // Prevent looking straight down
        
        // Photo-matched lighting
        this.setupLighting();
        
        // Create scene elements
        this.createValleyWalls();
        this.createLake();
        this.createIceEdge();
        this.createGlacierTongue();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Load background image (sky + mountains)
     */
    async loadBackgroundImage() {
        try {
            const textureLoader = new THREE.TextureLoader();
            this.backgroundTexture = await new Promise((resolve, reject) => {
                textureLoader.load(
                    '/assets/reference.jpg',
                    (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.warn('Background image not found, using solid color:', error);
                        resolve(null);
                    }
                );
            });
            
            if (this.backgroundTexture) {
                // Use as scene background
                this.scene.background = this.backgroundTexture;
            } else {
                // Fallback to sky blue
                this.scene.background = new THREE.Color(0x87CEEB);
            }
        } catch (error) {
            console.warn('Failed to load background image:', error);
            this.scene.background = new THREE.Color(0x87CEEB);
        }
    }

    /**
     * Setup photo-matched lighting
     */
    setupLighting() {
        // Strong directional "sun" light from upper right
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
        directionalLight.position.set(30, 50, 20); // Upper right
        directionalLight.castShadow = true;
        
        // Configure shadow map
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -60;
        directionalLight.shadow.camera.right = 60;
        directionalLight.shadow.camera.top = 40;
        directionalLight.shadow.camera.bottom = -40;
        directionalLight.shadow.bias = -0.0001;
        
        this.scene.add(directionalLight);
        
        // Hemisphere light for ambient
        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x5a5a5a, 0.5);
        this.scene.add(hemisphereLight);
        
        // Light fog for atmospheric depth
        this.scene.fog = new THREE.Fog(0x87CEEB, 60, 200);
    }

    /**
     * Create valley rock walls (left and right canyon walls)
     */
    createValleyWalls() {
        const wallHeight = 40;
        const wallDepth = 120;
        const segments = 150; // Heavy subdivision
        
        // Left wall
        const leftWallGeometry = new THREE.PlaneGeometry(60, wallDepth, segments, segments);
        const leftPositions = leftWallGeometry.attributes.position;
        const leftVertices = leftPositions.array;
        const leftColors = new Float32Array(leftVertices.length);
        
        for (let i = 0; i < leftVertices.length; i += 3) {
            const x = leftVertices[i];
            const z = leftVertices[i + 2];
            
            // Lower-frequency noise for gradual rock displacement
            const scale1 = 0.05;
            const scale2 = 0.1;
            const height1 = this.noise2D(x * scale1, z * scale1) * 8;
            const height2 = this.noise2D(x * scale2, z * scale2) * 4;
            
            // Base height decreases toward valley center
            const distanceFromValley = Math.abs(x + 30);
            const baseHeight = Math.max(0, (30 - distanceFromValley) / 30) * wallHeight;
            
            leftVertices[i + 1] = baseHeight + height1 + height2;
            
            // Color variation - dark rock with brown/grey variations
            const colorNoise = this.noise2D(x * 0.1, z * 0.1);
            const r = 0.2 + colorNoise * 0.1; // 0.2 to 0.3 (dark grey-brown)
            const g = 0.22 + colorNoise * 0.08;
            const b = 0.25 + colorNoise * 0.1;
            
            leftColors[i] = r;
            leftColors[i + 1] = g;
            leftColors[i + 2] = b;
        }
        
        leftWallGeometry.computeVertexNormals();
        leftWallGeometry.setAttribute('color', new THREE.BufferAttribute(leftColors, 3));
        
        const leftWallMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.0
        });
        
        const leftWall = new THREE.Mesh(leftWallGeometry, leftWallMaterial);
        leftWall.rotation.x = -Math.PI / 2;
        leftWall.position.set(-30, 0, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        this.scene.add(leftWall);
        this.valleyWalls.push(leftWall);
        
        // Right wall (mirrored)
        const rightWallGeometry = new THREE.PlaneGeometry(60, wallDepth, segments, segments);
        const rightPositions = rightWallGeometry.attributes.position;
        const rightVertices = rightPositions.array;
        const rightColors = new Float32Array(rightVertices.length);
        
        for (let i = 0; i < rightVertices.length; i += 3) {
            const x = rightVertices[i];
            const z = rightVertices[i + 2];
            
            const scale1 = 0.05;
            const scale2 = 0.1;
            const height1 = this.noise2D(x * scale1 + 2000, z * scale1 + 2000) * 8;
            const height2 = this.noise2D(x * scale2 + 2000, z * scale2 + 2000) * 4;
            
            const distanceFromValley = Math.abs(x - 30);
            const baseHeight = Math.max(0, (30 - distanceFromValley) / 30) * wallHeight;
            
            rightVertices[i + 1] = baseHeight + height1 + height2;
            
            const colorNoise = this.noise2D(x * 0.1 + 2000, z * 0.1 + 2000);
            const r = 0.2 + colorNoise * 0.1;
            const g = 0.22 + colorNoise * 0.08;
            const b = 0.25 + colorNoise * 0.1;
            
            rightColors[i] = r;
            rightColors[i + 1] = g;
            rightColors[i + 2] = b;
        }
        
        rightWallGeometry.computeVertexNormals();
        rightWallGeometry.setAttribute('color', new THREE.BufferAttribute(rightColors, 3));
        
        const rightWallMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.0
        });
        
        const rightWall = new THREE.Mesh(rightWallGeometry, rightWallMaterial);
        rightWall.rotation.x = -Math.PI / 2;
        rightWall.position.set(30, 0, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        this.scene.add(rightWall);
        this.valleyWalls.push(rightWall);
    }

    /**
     * Create realistic lake foreground
     */
    createLake() {
        const lakeGeometry = new THREE.PlaneGeometry(100, 80, 100, 80);
        const positions = lakeGeometry.attributes.position;
        const vertices = positions.array;
        
        // Initial ripples (will be animated in update loop)
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            const ripple = this.noise2D(x * 0.2, z * 0.2) * 0.2;
            vertices[i + 1] = ripple;
        }
        
        lakeGeometry.computeVertexNormals();
        
        const lakeMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x1a3a5c, // Dark blue
            roughness: 0.1, // Low roughness (0.05-0.15)
            metalness: 0.0,
            transmission: 0.3, // Some transmission for water
            transparent: true,
            opacity: 0.9
        });
        
        this.lakeMesh = new THREE.Mesh(lakeGeometry, lakeMaterial);
        this.lakeMesh.rotation.x = -Math.PI / 2;
        this.lakeMesh.position.set(0, 0.5, 35); // Foreground position
        this.lakeMesh.receiveShadow = true;
        this.scene.add(this.lakeMesh);
    }

    /**
     * Create thin ice/snow edge along lake shore
     */
    createIceEdge() {
        const iceGeometry = new THREE.PlaneGeometry(100, 15, 50, 15);
        const positions = iceGeometry.attributes.position;
        const vertices = positions.array;
        
        // Slight elevation and noise
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            vertices[i + 1] = 0.1 + this.noise2D(x * 0.3, z * 0.3) * 0.05;
        }
        
        iceGeometry.computeVertexNormals();
        
        const iceMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xD0E8F0, // Light blue-grey
            roughness: 0.7, // Higher roughness (0.6-0.8)
            metalness: 0.0,
            transparent: true,
            opacity: 0.85
        });
        
        this.iceEdgeMesh = new THREE.Mesh(iceGeometry, iceMaterial);
        this.iceEdgeMesh.rotation.x = -Math.PI / 2;
        this.iceEdgeMesh.position.set(0, 0.6, 35); // Slightly elevated above lake
        this.iceEdgeMesh.receiveShadow = true;
        this.scene.add(this.iceEdgeMesh);
    }

    /**
     * Create glacier tongue with crevasses
     */
    createGlacierTongue() {
        const segments = 300; // >= 300x300 segments
        const geometry = new THREE.PlaneGeometry(50, 80, segments, segments);
        
        const positions = geometry.attributes.position;
        const vertices = positions.array;
        const colors = new Float32Array(vertices.length);
        
        this.minHeight = Infinity;
        this.maxHeight = -Infinity;
        
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Broad slope (higher at back, lower at front)
            const baseSlope = -z * 0.15; // Downhill slope
            
            // Layered noise for terrain
            const scale1 = 0.08;
            const scale2 = 0.15;
            const scale3 = 0.3;
            const noise1 = this.noise2D(x * scale1, z * scale1) * 6;
            const noise2 = this.noise2D(x * scale2, z * scale2) * 3;
            const noise3 = this.noise2D(x * scale3, z * scale3) * 1.5;
            
            // Crevasses - grooves aligned along flow direction (Z-axis)
            // Use high-frequency noise to create crack patterns
            const crevasseFreq = 0.4;
            const crevasseNoise = this.noise2D(x * crevasseFreq, z * crevasseFreq * 0.3);
            // Create grooves by subtracting height where noise is low
            const crevasseDepth = crevasseNoise < -0.3 ? (crevasseNoise + 0.3) * 4 : 0;
            
            // Base height modulated by mass index
            const massHeight = (this.massIndex / 100) * 5;
            
            const height = baseSlope + noise1 + noise2 + noise3 + crevasseDepth + massHeight;
            
            // Clamp displacement to prevent explosion
            const clampedHeight = Math.max(-5, Math.min(15, height));
            
            vertices[i + 1] = clampedHeight;
            
            // Track height range
            if (clampedHeight < this.minHeight) this.minHeight = clampedHeight;
            if (clampedHeight > this.maxHeight) this.maxHeight = clampedHeight;
            
            // Height-based vertex colors (whiter peaks, bluer cracks)
            const normalizedHeight = (clampedHeight - this.minHeight) / (this.maxHeight - this.minHeight || 1);
            const isCrevasse = crevasseNoise < -0.3;
            
            if (isCrevasse) {
                // Blue tint for crevasses
                colors[i] = 0.85;
                colors[i + 1] = 0.9;
                colors[i + 2] = 1.0;
            } else {
                // White peaks, slight blue in valleys
                const r = 0.95 + normalizedHeight * 0.05;
                const g = 0.97 + normalizedHeight * 0.03;
                const b = 1.0;
                colors[i] = r;
                colors[i + 1] = g;
                colors[i + 2] = b;
            }
        }
        
        geometry.computeVertexNormals(); // Compute normals after displacement
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // MeshPhysicalMaterial for ice with blue subsurface tint
        const material = new THREE.MeshPhysicalMaterial({
            vertexColors: true,
            color: 0xF0F8FF, // Near-white base color
            roughness: 0.6 + (100 - this.massIndex) / 100 * 0.2, // Subtle roughness change with mass
            metalness: 0.0,
            transmission: 0.1, // Slight transmission for ice
            thickness: 0.5
        });
        
        this.glacierMesh = new THREE.Mesh(geometry, material);
        this.glacierMesh.rotation.x = -Math.PI / 2; // Rotate flat
        this.glacierMesh.position.set(0, 8, -20); // Position mid-frame
        this.glacierMesh.castShadow = true;
        this.glacierMesh.receiveShadow = true;
        this.scene.add(this.glacierMesh);
    }

    /**
     * Update glacier mass balance based on weather data
     */
    updateMassBalance(weather) {
        const { temperature, windSpeed, precipitation } = weather;
        
        // Accumulation from precipitation (only snow when temp <= 1°C)
        let accumulation = 0;
        if (temperature <= 1.0) {
            accumulation = precipitation * this.accumulationRate;
        }
        
        // Melt only applies when temperature is above 0°C
        const melt = temperature > 0 ? temperature * this.meltRate : 0;
        
        // Sublimation loss from wind
        const sublimation = windSpeed * this.sublimationRate;
        
        // Net daily change
        this.dailyChange = accumulation - melt - sublimation;
        
        // Update mass index
        this.massIndex += this.dailyChange;
        this.massIndex = Math.max(10, Math.min(200, this.massIndex));
        
        // Update 7-day rolling average
        this.massHistory.push(this.massIndex);
        if (this.massHistory.length > this.maxHistoryLength) {
            this.massHistory.shift();
        }
        
        // Calculate 7-day trend
        if (this.massHistory.length >= 2) {
            this.sevenDayTrend = this.massHistory[this.massHistory.length - 1] - this.massHistory[0];
        } else {
            this.sevenDayTrend = this.dailyChange;
        }
        
        // Determine state based on 7-day trend
        if (this.sevenDayTrend > this.advancingThreshold) {
            this.state = 'Advancing';
        } else if (this.sevenDayTrend < this.recedingThreshold) {
            this.state = 'Receding';
        } else {
            this.state = 'Stable';
        }
        
        // Update visual representation
        this.updateGlacierVisual();
    }

    /**
     * Update glacier mesh to reflect current mass
     */
    updateGlacierVisual() {
        if (!this.glacierMesh) return;
        
        const geometry = this.glacierMesh.geometry;
        const positions = geometry.attributes.position;
        const vertices = positions.array;
        const colors = geometry.attributes.color;
        
        this.minHeight = Infinity;
        this.maxHeight = -Infinity;
        
        // Update vertex heights with mass scaling
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Broad slope
            const baseSlope = -z * 0.15;
            
            // Layered noise
            const scale1 = 0.08;
            const scale2 = 0.15;
            const scale3 = 0.3;
            const noise1 = this.noise2D(x * scale1, z * scale1 + this.noiseOffset) * 6;
            const noise2 = this.noise2D(x * scale2, z * scale2 + this.noiseOffset * 0.5) * 3;
            const noise3 = this.noise2D(x * scale3, z * scale3 + this.noiseOffset * 0.25) * 1.5;
            
            // Crevasses
            const crevasseFreq = 0.4;
            const crevasseNoise = this.noise2D(x * crevasseFreq, z * crevasseFreq * 0.3 + this.noiseOffset * 0.1);
            const crevasseDepth = crevasseNoise < -0.3 ? (crevasseNoise + 0.3) * 4 : 0;
            
            // Mass-based height scaling (subtle)
            const massHeight = (this.massIndex / 100) * 5;
            
            const height = (baseSlope + noise1 + noise2 + noise3 + crevasseDepth + massHeight) * this.exaggeration;
            const clampedHeight = Math.max(-5, Math.min(15, height));
            
            vertices[i + 1] = clampedHeight;
            
            if (clampedHeight < this.minHeight) this.minHeight = clampedHeight;
            if (clampedHeight > this.maxHeight) this.maxHeight = clampedHeight;
            
            // Update colors
            const normalizedHeight = (clampedHeight - this.minHeight) / (this.maxHeight - this.minHeight || 1);
            const isCrevasse = crevasseNoise < -0.3;
            
            if (isCrevasse) {
                colors.array[i] = 0.85;
                colors.array[i + 1] = 0.9;
                colors.array[i + 2] = 1.0;
            } else {
                const r = 0.95 + normalizedHeight * 0.05;
                const g = 0.97 + normalizedHeight * 0.03;
                const b = 1.0;
                colors.array[i] = r;
                colors.array[i + 1] = g;
                colors.array[i + 2] = b;
            }
        }
        
        // Update material roughness based on mass
        if (this.glacierMesh.material) {
            this.glacierMesh.material.roughness = 0.6 + (100 - this.massIndex) / 100 * 0.2;
        }
        
        colors.needsUpdate = true;
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
    }

    /**
     * Update animation (called each frame)
     */
    update(deltaTime) {
        this.time += deltaTime;
        
        // Shift noise offset for flow effect
        this.noiseOffset += deltaTime * 0.1;
        
        // Update lake ripples
        if (this.lakeMesh) {
            const geometry = this.lakeMesh.geometry;
            const positions = geometry.attributes.position;
            const vertices = positions.array;
            
            for (let i = 0; i < vertices.length; i += 3) {
                const x = vertices[i];
                const z = vertices[i + 2];
                const ripple = this.noise2D(x * 0.2, z * 0.2 + this.time * 0.5) * 0.2;
                vertices[i + 1] = ripple;
            }
            
            positions.needsUpdate = true;
            geometry.computeVertexNormals();
        }
        
        // Update visual periodically
        this.lastVisualUpdate += deltaTime;
        if (this.lastVisualUpdate >= this.visualUpdateInterval) {
            this.updateGlacierVisual();
            this.lastVisualUpdate = 0;
        }
        
        // Update controls
        this.controls.update();
    }

    /**
     * Render the scene
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Set environment map for realistic reflections
     */
    setEnvironmentMap(envMap) {
        if (this.glacierMesh && this.glacierMesh.material) {
            this.glacierMesh.material.envMap = envMap;
            this.glacierMesh.material.needsUpdate = true;
        }
    }

    /**
     * Set exaggeration factor
     */
    setExaggeration(value) {
        this.exaggeration = value;
        this.updateGlacierVisual();
    }

    /**
     * Reset glacier to initial state
     */
    reset() {
        this.massIndex = 100.0;
        this.dailyChange = 0.0;
        this.sevenDayTrend = 0.0;
        this.state = 'Stable';
        this.massHistory = [];
        this.time = 0;
        this.noiseOffset = 0;
        this.updateGlacierVisual();
    }

    /**
     * Get current glacier state
     */
    getState() {
        return {
            state: this.state,
            massIndex: this.massIndex,
            dailyChange: this.dailyChange,
            sevenDayTrend: this.sevenDayTrend
        };
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
