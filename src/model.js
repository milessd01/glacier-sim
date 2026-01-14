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

  getSummary(observation) {
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

    return [
      `${state} today based on temperature, snowfall, and wind conditions.`,
      dailyLine,
      trendLine
    ].join(' ');
  }
}
