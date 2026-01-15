import Chart from 'chart.js/auto';

const formatNumber = (value, digits = 1) =>
  Number.isFinite(value) ? value.toFixed(digits) : '--';

const formatDateTime = (date, timezoneAbbr) => {
  if (!(date instanceof Date)) return '--';
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return `${date.toLocaleString(undefined, options)} ${timezoneAbbr || ''}`.trim();
};

export class DashboardUI {
  constructor() {
    this.elements = this.cacheElements();
    this.currentScenario = null;
    this.chartWindowDays = 30;
    this.bindEvents();
    this.initCharts();
    this.setChartWindow(this.chartWindowDays);
  }

  cacheElements() {
    return {
      temperature: document.getElementById('temperature'),
      windSpeed: document.getElementById('wind-speed'),
      precipitation: document.getElementById('precipitation'),
      humidity: document.getElementById('humidity'),
      pressure: document.getElementById('pressure'),
      timestamp: document.getElementById('timestamp'),
      dataStatus: document.getElementById('data-status'),
      glacierState: document.getElementById('glacier-state'),
      confidenceBadge: document.getElementById('confidence-badge'),
      confidenceWhy: document.getElementById('confidence-why'),
      alerts: document.getElementById('alert-badges'),
      healthIndex: document.getElementById('health-index'),
      dailyChange: document.getElementById('daily-change'),
      sevenDayTrend: document.getElementById('seven-day-trend'),
      summary: document.getElementById('daily-summary'),
      simulateButtons: document.querySelectorAll('[data-simulate]'),
      refreshButton: document.getElementById('refresh-weather'),
      simulationSource: document.getElementById('simulation-source'),
      scenarioStatus: document.getElementById('scenario-status'),
      scenarioButtons: document.querySelectorAll('[data-scenario]'),
      chartWindowHealth: document.getElementById('chart-window-health'),
      chartWindowMass: document.getElementById('chart-window-mass'),
      timeToLossValue: document.getElementById('time-to-loss-value'),
      timeToLossMeta: document.getElementById('time-to-loss-meta'),
      timeToLossSource: document.getElementById('time-to-loss-source'),
      chartHealth: document.getElementById('chart-health'),
      chartMass: document.getElementById('chart-mass')
    };
  }

  bindEvents() {
    this.elements.refreshButton?.addEventListener('click', () => {
      this.onRefreshCallback?.();
    });

    this.elements.simulateButtons?.forEach((button) => {
      button.addEventListener('click', () => {
        const days = Number(button.dataset.simulate || 1);
        this.onSimulateCallback?.(days);
      });
    });

    this.elements.scenarioButtons?.forEach((button) => {
      button.addEventListener('click', () => {
        this.setScenario(button.dataset.scenario);
        this.onScenarioSelectCallback?.(this.currentScenario);
      });
    });

  }

  initCharts() {
    this.healthChart = new Chart(this.elements.chartHealth, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Health Index',
            data: [],
            borderColor: '#4aa3ff',
            backgroundColor: 'rgba(74, 163, 255, 0.2)',
            tension: 0.35,
            fill: true,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              color: 'rgba(255,255,255,0.08)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    this.massChart = new Chart(this.elements.chartMass, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Daily Mass Change',
            data: [],
            backgroundColor: (ctx) => {
              const value = ctx.raw ?? 0;
              return value >= 0 ? 'rgba(120, 214, 167, 0.7)' : 'rgba(255, 99, 99, 0.7)';
            }
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            grid: {
              color: 'rgba(255,255,255,0.08)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  updateCurrentConditions(result) {
    if (!result.ok || !result.data) return;
    const {
      temperature,
      windSpeed,
      precipitation,
      humidity,
      pressure,
      date,
      timezoneAbbr
    } = result.data;
    this.elements.temperature.textContent = formatNumber(temperature, 1);
    this.elements.windSpeed.textContent = formatNumber(windSpeed, 1);
    this.elements.precipitation.textContent = formatNumber(precipitation, 2);
    this.elements.humidity.textContent = formatNumber(humidity, 0);
    this.elements.pressure.textContent = formatNumber(pressure, 0);
    this.elements.timestamp.textContent = formatDateTime(date, timezoneAbbr);
  }

  updateDataStatus(result) {
    if (!this.elements.dataStatus) return;
    if (result.mode === 'scenario') {
      this.elements.dataStatus.textContent = 'Scenario mode';
      this.elements.dataStatus.className = 'status-pill fallback';
      this.setScenarioMode(true);
      return;
    }
    if (result.ok) {
      this.elements.dataStatus.textContent = 'Live data';
      this.elements.dataStatus.className = 'status-pill live';
      this.setScenarioMode(false);
    } else {
      this.elements.dataStatus.textContent = 'Fallback mode';
      this.elements.dataStatus.className = 'status-pill fallback';
      this.setScenarioMode(false);
    }
  }

  updateSimulationSource(result) {
    if (!this.elements.simulationSource) return;
    this.elements.simulationSource.textContent = `Simulation source: ${result.sourceLabel}`;
  }

  updateScenarioStatus(label) {
    if (this.elements.scenarioStatus) {
      this.elements.scenarioStatus.textContent = `Scenario: ${label}`;
    }
  }

  updateModelOutputs(state) {
    this.elements.healthIndex.textContent = formatNumber(state.healthIndex, 1);
    this.elements.dailyChange.textContent = formatNumber(state.dailyChange, 2);
    this.elements.sevenDayTrend.textContent = formatNumber(state.sevenDayTrend, 2);
    this.elements.glacierState.textContent = state.state;
    this.elements.glacierState.className = `badge ${state.state.toLowerCase()}`;
  }

  updateDiagnostics({ alerts, confidence, projection, sourceLabel }) {
    if (this.elements.alerts) {
      this.elements.alerts.innerHTML = '';
      alerts.forEach((alert) => {
        const badge = document.createElement('span');
        badge.className = `alert-badge ${alert.level}`;
        badge.textContent = alert.label;
        badge.title = alert.detail;
        this.elements.alerts.appendChild(badge);
      });
    }

    if (this.elements.confidenceBadge) {
      this.elements.confidenceBadge.textContent = confidence.level;
      this.elements.confidenceBadge.className = `confidence-badge ${confidence.level.toLowerCase()}`;
    }

    if (this.elements.confidenceWhy) {
      this.elements.confidenceWhy.textContent = confidence.reasons.join(' • ');
    }

    if (this.elements.timeToLossValue) {
      this.elements.timeToLossValue.textContent = projection.message;
    }

    if (this.elements.timeToLossMeta) {
      this.elements.timeToLossMeta.textContent =
        projection.status === 'declining'
          ? 'Based on 7-day rolling trend.'
          : 'No collapse projected under current conditions.';
    }

    if (this.elements.timeToLossSource) {
      this.elements.timeToLossSource.textContent = `Source: ${sourceLabel}`;
    }
  }

  updateCharts(history) {
    const windowDays = this.chartWindowDays || 30;
    const sliced = history.slice(-windowDays);
    const labels = sliced.map((entry) =>
      entry.date instanceof Date
        ? entry.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '--'
    );
    const healthData = sliced.map((entry) => entry.healthIndex);
    const massData = sliced.map((entry) => entry.dailyChange);

    this.healthChart.data.labels = labels;
    this.healthChart.data.datasets[0].data = healthData;
    this.healthChart.update();

    this.massChart.data.labels = labels;
    this.massChart.data.datasets[0].data = massData;
    this.massChart.update();
  }

  updateDailySummary(text) {
    if (this.elements.summary) {
      this.elements.summary.textContent = text;
    }
  }

  onRefresh(callback) {
    this.onRefreshCallback = callback;
  }

  onSimulate(callback) {
    this.onSimulateCallback = callback;
  }

  onScenarioSimulate(callback) {
    this.onScenarioSimulateCallback = callback;
  }

  onScenarioSelect(callback) {
    this.onScenarioSelectCallback = callback;
  }

  setScenario(value) {
    this.currentScenario = value;
    this.elements.scenarioButtons?.forEach((button) => {
      const isActive = button.dataset.scenario === value;
      button.classList.toggle('active', isActive);
    });
  }

  setScenarioMode(enabled) {
    this.elements.simulateButtons?.forEach((button) => {
      button.disabled = enabled;
      button.classList.toggle('disabled', enabled);
    });

    if (!enabled) {
      this.setScenario(null);
    }
  }

  setChartWindow(days) {
    this.chartWindowDays = days;
    if (this.elements.chartWindowHealth) {
      this.elements.chartWindowHealth.textContent = String(days);
    }
    if (this.elements.chartWindowMass) {
      this.elements.chartWindowMass.textContent = String(days);
    }
  }
}
