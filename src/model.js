const DEFAULTS = {
  accumulationRate: 0.1,
  meltRate: 0.05,
  sublimationRate: 0.01,
  advancingThreshold: 0.1,
  recedingThreshold: -0.1
};

export class GlacierModel {
  constructor(options = {}) {
    this.params = { ...DEFAULTS, ...options };
    this.healthIndex = 100;
    this.history = [];
    this.maxHistory = 30;
    this.lastSource = 'Observed';
    this.dataContext = {
      sourceLabel: 'Observed',
      ageHours: null,
      isFallback: false,
      isForecast: false,
      isScenario: false,
      isStale: false
    };
  }

  applyDailyObservation(observation, sourceLabel = 'Observed') {
    const dailyChange = this.calculateDailyMassChange(observation);
    this.healthIndex = Math.max(0, Math.min(200, this.healthIndex + dailyChange));
    this.lastSource = sourceLabel;

    this.history.push({
      date: observation.date,
      dailyChange,
      healthIndex: this.healthIndex,
      sourceLabel
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  calculateDailyMassChange({ temperature, windSpeed, precipitation }) {
    const accumulation =
      temperature <= 1 ? precipitation * this.params.accumulationRate : 0;
    const melt = temperature > 0 ? temperature * this.params.meltRate : 0;
    const sublimation = windSpeed * this.params.sublimationRate;
    return accumulation - melt - sublimation;
  }

  getSevenDayTrend() {
    const window = this.history.slice(-7);
    if (window.length === 0) return 0;
    const total = window.reduce((sum, entry) => sum + entry.dailyChange, 0);
    return total / window.length;
  }

  getTrendWindow() {
    return this.history.slice(-7);
  }

  getTrendVariance() {
    const window = this.getTrendWindow();
    if (window.length < 2) return 0;
    const values = window.map((entry) => entry.dailyChange);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  getState() {
    const trend = this.getSevenDayTrend();
    let state = 'Stable';
    if (trend > this.params.advancingThreshold) state = 'Advancing';
    if (trend < this.params.recedingThreshold) state = 'Receding';

    const latest = this.history[this.history.length - 1];

    return {
      healthIndex: this.healthIndex,
      dailyChange: latest ? latest.dailyChange : 0,
      sevenDayTrend: trend,
      state,
      lastSource: this.lastSource
    };
  }

  getHistory() {
    return [...this.history];
  }

  setDataContext(context) {
    this.dataContext = {
      ...this.dataContext,
      ...context
    };
  }

  getAlerts() {
    const alerts = [];
    const state = this.getState();

    if (state.healthIndex < 50) {
      alerts.push({
        id: 'critical-loss',
        level: 'critical',
        label: 'Critical Loss Phase',
        detail: 'Health index below 50 indicates severe structural loss.'
      });
    } else if (state.healthIndex < 70) {
      alerts.push({
        id: 'integrity-warning',
        level: 'warning',
        label: 'Integrity Warning',
        detail: 'Health index below 70 signals weakening glacier integrity.'
      });
    }

    if (state.dailyChange < -2.5) {
      alerts.push({
        id: 'high-melt',
        level: 'warning',
        label: 'High Melt Event',
        detail: 'Daily mass loss exceeds 2.5 units.'
      });
    }

    if (state.sevenDayTrend < -1.2) {
      alerts.push({
        id: 'accelerated-loss',
        level: 'critical',
        label: 'Accelerated Loss Detected',
        detail: '7-day trend indicates rapid retreat.'
      });
    }

    if (this.dataContext.isFallback || this.dataContext.isStale) {
      alerts.push({
        id: 'low-reliability',
        level: 'info',
        label: 'Low Data Reliability',
        detail: this.dataContext.isStale
          ? 'Live data is stale; results may be delayed.'
          : 'Fallback or simulated data in use.'
      });
    }

    return alerts;
  }

  getConfidence() {
    const reasons = [];
    const variance = this.getTrendVariance();
    const { isFallback, isScenario, isForecast, isStale, ageHours } = this.dataContext;

    if (isFallback || isScenario) {
      reasons.push('Using simulated or scenario data');
    }
    if (isForecast) {
      reasons.push('Using forecast data');
    }
    if (isStale) {
      reasons.push('Live data is stale');
    }
    if (typeof ageHours === 'number' && ageHours <= 2 && !isStale) {
      reasons.push('Live data is fresh');
    }
    if (variance >= 1.2) {
      reasons.push('High volatility in 7-day trend');
    } else if (variance >= 0.6) {
      reasons.push('Moderate trend variability');
    } else {
      reasons.push('Low trend variability');
    }

    let level = 'Medium';
    if (isFallback || isScenario || isStale || variance >= 1.5) {
      level = 'Low';
    } else if (isForecast || variance >= 0.6) {
      level = 'Medium';
    } else {
      level = 'High';
    }

    return { level, reasons, variance };
  }

  getTimeToLoss(collapseThreshold = 40) {
    const state = this.getState();
    const trend = state.sevenDayTrend;
    const remaining = state.healthIndex - collapseThreshold;

    if (remaining <= 0) {
      return {
        status: 'collapsed',
        message: 'Threshold already crossed.',
        days: 0,
        years: 0
      };
    }

    if (trend >= -0.05) {
      return {
        status: 'stable',
        message: 'No collapse projected under current conditions.',
        days: null,
        years: null
      };
    }

    const daysLeft = remaining / Math.abs(trend);
    const years = Math.floor(daysLeft / 365);
    const days = Math.round(daysLeft % 365);

    return {
      status: 'declining',
      message: `~${years} years, ${days} days remaining.`,
      days: daysLeft,
      years
    };
  }

  getSnapshot() {
    return {
      healthIndex: this.healthIndex,
      history: this.getHistory(),
      lastSource: this.lastSource
    };
  }

  setSnapshot(snapshot) {
    if (!snapshot) return;
    this.healthIndex = snapshot.healthIndex ?? 100;
    this.history = Array.isArray(snapshot.history) ? [...snapshot.history] : [];
    this.lastSource = snapshot.lastSource || 'Observed';
  }

  resetWithObservation(observation, sourceLabel = 'Observed') {
    this.healthIndex = 100;
    this.history = [];
    this.lastSource = sourceLabel;
    if (observation) {
      this.applyDailyObservation(observation, sourceLabel);
    }
  }

  getSummary(observation, diagnostics = {}) {
    const { temperature, precipitation, windSpeed } = observation;
    const trend = this.getSevenDayTrend();
    const state = this.getState().state;
    const accumulation =
      temperature <= 1 ? precipitation * this.params.accumulationRate : 0;
    const melt = temperature > 0 ? temperature * this.params.meltRate : 0;
    const sublimation = windSpeed * this.params.sublimationRate;

    const drivers = [];
    if (accumulation > 0) {
      drivers.push(`snowfall adds +${accumulation.toFixed(2)}`);
    }
    if (melt > 0) {
      drivers.push(`melt removes -${melt.toFixed(2)}`);
    }
    if (sublimation > 0) {
      drivers.push(`wind sublimation removes -${sublimation.toFixed(2)}`);
    }
    if (drivers.length === 0) {
      drivers.push('conditions are mostly neutral');
    }

    const dailyChange = this.getState().dailyChange;
    const dailyLine =
      dailyChange >= 0
        ? `Daily mass change is +${dailyChange.toFixed(2)} driven by ${drivers.join(
            ', '
          )}.`
        : `Daily mass change is ${dailyChange.toFixed(2)} driven by ${drivers.join(', ')}.`;

    const window = this.history.slice(-7);
    const positives = window.filter((entry) => entry.dailyChange >= 0).length;
    const negatives = window.filter((entry) => entry.dailyChange < 0).length;
    const trendLine =
      trend >= 0
        ? `The 7-day trend averages +${trend.toFixed(2)} because ${positives} of the last ${window.length} days gained mass.`
        : `The 7-day trend averages ${trend.toFixed(2)} because ${negatives} of the last ${window.length} days lost mass.`;

    const base = [
      `${state} today based on temperature, snowfall, and wind conditions.`,
      dailyLine,
      trendLine
    ];

    const summaryExtras = [];
    if (diagnostics.alerts && diagnostics.alerts.length > 0) {
      summaryExtras.push(
        `Active alerts: ${diagnostics.alerts.map((alert) => alert.label).join(', ')}.`
      );
    }
    if (diagnostics.projection) {
      summaryExtras.push(`Time-to-loss: ${diagnostics.projection.message}`);
    }
    if (diagnostics.confidence) {
      summaryExtras.push(`Model confidence is ${diagnostics.confidence.level}.`);
    }

    return [...base, ...summaryExtras].join(' ');
  }
}
