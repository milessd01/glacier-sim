function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export class WeatherService {
  constructor({ latitude, longitude, name, timezone, provider }) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.name = name;
    this.timezone = timezone || 'auto';
    this.provider = provider || 'open-meteo';
    this.cache = {
      current: null,
      fetchedAt: 0
    };
  }

  async fetchCurrent({ force = false } = {}) {
    const now = Date.now();
    if (!force && this.cache.current && now - this.cache.fetchedAt < 5 * 60 * 1000) {
      return this.cache.current;
    }

    try {
      let result;
      if (this.provider === 'nws') {
        result = await this.fetchNwsCurrent();
      } else if (this.provider === 'nws-hybrid') {
        result = await this.fetchHybridCurrent();
      } else {
        result = await this.fetchOpenMeteoCurrent();
      }
      this.cache.current = result;
      this.cache.fetchedAt = now;
      return result;
    } catch (error) {
      const result = {
        ok: false,
        sourceLabel: 'Fallback',
        error
      };
      this.cache.current = result;
      this.cache.fetchedAt = now;
      return result;
    }
  }

  async fetchOpenMeteoCurrent() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.latitude}&longitude=${this.longitude}&current=temperature_2m,wind_speed_10m,precipitation,relative_humidity_2m,surface_pressure&timezone=${this.timezone}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }
    const data = await response.json();
    const current = data.current || {};
    const timestamp = current.time || data.current_time;
    const timezone = data.timezone || 'UTC';
    const timezoneAbbr = data.timezone_abbreviation || 'UTC';

    return {
      ok: true,
      sourceLabel: 'Observed',
      data: {
        temperature: current.temperature_2m ?? 0,
        windSpeed: current.wind_speed_10m ?? 0,
        precipitation: current.precipitation ?? 0,
        humidity: current.relative_humidity_2m ?? 0,
        pressure: current.surface_pressure ?? 0,
        date: timestamp ? new Date(timestamp) : new Date(),
        timezone,
        timezoneAbbr
      }
    };
  }

  async fetchNwsCurrent() {
    const pointUrl = `https://api.weather.gov/points/${this.latitude},${this.longitude}`;
    const pointResponse = await fetch(pointUrl, {
      headers: {
        'User-Agent': 'Glacier Mission Control (glacier-sim)',
        Accept: 'application/geo+json'
      }
    });
    if (!pointResponse.ok) {
      throw new Error(`NWS point lookup failed: ${pointResponse.status}`);
    }
    const pointData = await pointResponse.json();
    const stationsUrl = pointData?.properties?.observationStations;
    if (!stationsUrl) {
      throw new Error('NWS stations URL missing');
    }

    const stationsResponse = await fetch(stationsUrl, {
      headers: {
        'User-Agent': 'Glacier Mission Control (glacier-sim)',
        Accept: 'application/geo+json'
      }
    });
    if (!stationsResponse.ok) {
      throw new Error(`NWS stations lookup failed: ${stationsResponse.status}`);
    }
    const stationsData = await stationsResponse.json();
    const stationId = stationsData?.features?.[0]?.properties?.stationIdentifier;
    if (!stationId) {
      throw new Error('No NWS station found for location');
    }

    const obsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
    const obsResponse = await fetch(obsUrl, {
      headers: {
        'User-Agent': 'Glacier Mission Control (glacier-sim)',
        Accept: 'application/geo+json'
      }
    });
    if (!obsResponse.ok) {
      throw new Error(`NWS observation failed: ${obsResponse.status}`);
    }
    const obsData = await obsResponse.json();
    const obs = obsData?.properties || {};

    const temperature = obs.temperature?.value;
    const windSpeedMs = obs.windSpeed?.value;
    const humidity = obs.relativeHumidity?.value;
    const pressurePa = obs.seaLevelPressure?.value || obs.barometricPressure?.value;
    const precipitation = obs.precipitationLastHour?.value || 0;
    const timestamp = obs.timestamp;
    const timezone = obsData?.properties?.timeZone || 'UTC';
    const timezoneAbbr = obs.timeZone || 'UTC';

    return {
      ok: true,
      sourceLabel: 'Observed (NWS)',
      data: {
        temperature: typeof temperature === 'number' ? temperature : 0,
        windSpeed: typeof windSpeedMs === 'number' ? windSpeedMs * 3.6 : 0,
        precipitation: typeof precipitation === 'number' ? precipitation : 0,
        humidity: typeof humidity === 'number' ? humidity : 0,
        pressure: typeof pressurePa === 'number' ? pressurePa / 100 : 0,
        date: timestamp ? new Date(timestamp) : new Date(),
        timezone,
        timezoneAbbr
      }
    };
  }

  async fetchHybridCurrent() {
    const [nws, meteo] = await Promise.all([
      this.fetchNwsCurrent(),
      this.fetchOpenMeteoCurrent()
    ]);

    return {
      ok: true,
      sourceLabel: 'Observed (NWS + Open-Meteo)',
      data: {
        temperature: nws.data.temperature,
        windSpeed: nws.data.windSpeed,
        precipitation: meteo.data.precipitation,
        humidity: meteo.data.humidity,
        pressure: meteo.data.pressure,
        date: nws.data.date || meteo.data.date,
        timezone: meteo.data.timezone || nws.data.timezone,
        timezoneAbbr: meteo.data.timezoneAbbr || nws.data.timezoneAbbr
      }
    };
  }

  async fetchDailySeries(days) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.latitude}&longitude=${this.longitude}&daily=temperature_2m_mean,wind_speed_10m_max,precipitation_sum&forecast_days=${days}&timezone=${this.timezone}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Forecast request failed: ${response.status}`);
      }
      const data = await response.json();
      if (!data.daily || !data.daily.time) {
        throw new Error('Forecast missing daily series');
      }

      const series = data.daily.time.map((time, index) => ({
        date: new Date(time),
        temperature: data.daily.temperature_2m_mean[index],
        windSpeed: data.daily.wind_speed_10m_max[index],
        precipitation: data.daily.precipitation_sum[index]
      }));

      return {
        ok: true,
        sourceLabel: 'Forecast',
        series
      };
    } catch (error) {
      const fallback = await this.fetchCurrent();
      const current = fallback.data || {
        temperature: 0,
        windSpeed: 0,
        precipitation: 0,
        date: new Date()
      };
      const series = this.generateSimulatedSeries(current, days);
      return {
        ok: false,
        sourceLabel: 'Simulated',
        series,
        error
      };
    }
  }

  generateScenarioSeries(current, days, scenario) {
    const seed =
      Math.floor(current.date.getTime() / 86400000) +
      Math.round(this.latitude * 100) +
      Math.round(Math.abs(this.longitude) * 100) +
      scenario.length * 31;
    const random = seededRandom(seed);
    const series = [];

    const scenarioConfig = {
      neutral: {
        tempShift: -0.6,
        tempTrend: 0.0,
        precipFactor: 1.05,
        windShift: 0.1,
        seasonalAmp: 5.5
      },
      'ice-age': {
        tempShift: -12.5,
        tempTrend: -0.35,
        precipFactor: 1.6,
        windShift: -1.2,
        seasonalAmp: 7.0
      },
      warming: {
        tempShift: 3.8,
        tempTrend: 0.3,
        precipFactor: 1.2,
        windShift: 0.4,
        seasonalAmp: 6.0
      }
    };
    const config = scenarioConfig[scenario] || scenarioConfig.neutral;

    for (let i = 0; i < days; i += 1) {
      const nextDate = new Date(current.date);
      nextDate.setDate(nextDate.getDate() + i + 1);
      const dayOfYear = Math.floor(
        (Date.UTC(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()) -
          Date.UTC(nextDate.getFullYear(), 0, 0)) /
          86400000
      );
      const seasonal =
        Math.cos(((dayOfYear - 10) / 365) * Math.PI * 2) * config.seasonalAmp;
      const trend = config.tempTrend * (i + 1);
      const noiseScale = scenario === 'ice-age' ? 0.6 : 1.0;
      const tempNoise = (random() - 0.5) * 1.8 * noiseScale;
      const windNoise = (random() - 0.5) * 2.6 * noiseScale;
      const stormChance = random();
      const stormBoost = stormChance > 0.8 ? 1.5 + random() * 1.5 : 0;
      const precipNoise = Math.max(0, current.precipitation + (random() - 0.35));
      const minPrecip = scenario === 'ice-age' ? 0.6 : 0;

      const adjustedTemp =
        current.temperature + config.tempShift + seasonal + trend + tempNoise;
      const adjustedWind =
        Math.max(0, current.windSpeed + config.windShift + windNoise);
      const adjustedPrecip = Math.max(
        minPrecip,
        (precipNoise + stormBoost) * config.precipFactor
      );

      series.push({
        date: nextDate,
        temperature: adjustedTemp,
        windSpeed: adjustedWind,
        precipitation: adjustedPrecip
      });
    }

    const labels = {
      'ice-age': 'Ice Age',
      warming: 'More Warming'
    };

    return {
      ok: true,
      sourceLabel: `Scenario: ${labels[scenario] || 'Ice Age'}`,
      series
    };
  }

  async fetchScenarioSeries(days, scenario, baseline) {
    const current = baseline || (await this.fetchCurrent()).data || {
      temperature: 0,
      windSpeed: 0,
      precipitation: 0,
      date: new Date()
    };
    return this.generateScenarioSeries(current, days, scenario);
  }

  generateSimulatedSeries(current, days) {
    const seed =
      Math.floor(current.date.getTime() / 86400000) +
      Math.round(this.latitude * 100) +
      Math.round(Math.abs(this.longitude) * 100);
    const random = seededRandom(seed);
    const series = [];

    for (let i = 0; i < days; i += 1) {
      const tempNoise = (random() - 0.5) * 4;
      const windNoise = (random() - 0.5) * 6;
      const precipNoise = Math.max(0, current.precipitation + (random() - 0.3));
      const nextDate = new Date(current.date);
      nextDate.setDate(nextDate.getDate() + i + 1);

      series.push({
        date: nextDate,
        temperature: current.temperature + tempNoise,
        windSpeed: Math.max(0, current.windSpeed + windNoise),
        precipitation: Math.max(0, precipNoise)
      });
    }

    return series;
  }
}
