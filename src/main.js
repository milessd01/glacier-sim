import { WeatherService } from './weather.js';
import { GlacierModel } from './model.js';
import { DashboardUI } from './ui.js';

const weather = new WeatherService({
  latitude: 58.4,
  longitude: -134.4,
  name: 'Mendenhall Glacier',
  timezone: 'auto'
});

const model = new GlacierModel();
const ui = new DashboardUI();
let baselineSnapshot = null;
let lastObservedDateKey = null;
let lastObservedData = null;

const infoPanel = document.getElementById('info-panel');
const infoButton = document.getElementById('glacier-info');
const infoHome = document.getElementById('info-home');

function showInfoPanel(show) {
  if (!infoPanel) return;
  infoPanel.classList.toggle('hidden', !show);
}

infoButton?.addEventListener('click', () => showInfoPanel(true));
infoHome?.addEventListener('click', () => showInfoPanel(false));

function toDateKey(date) {
  if (!(date instanceof Date)) return null;
  return date.toISOString().slice(0, 10);
}

async function loadCurrentConditions(reset = false) {
  const result = await weather.fetchCurrent();
  const ageHours = result.data?.date
    ? (Date.now() - result.data.date.getTime()) / 3600000
    : null;
  const isStale = typeof ageHours === 'number' && ageHours > 2;
  ui.updateCurrentConditions(result);
  ui.updateDataStatus({ ...result, isStale });

  if (result.ok && result.data) {
    const dateKey = toDateKey(result.data.date);
    const shouldAdvance = dateKey && dateKey !== lastObservedDateKey;
    if (reset || shouldAdvance) {
      model.resetWithObservation(result.data, result.sourceLabel);
      model.setDataContext({
        sourceLabel: result.sourceLabel,
        ageHours,
        isFallback: false,
        isForecast: false,
        isScenario: false,
        isStale
      });
      baselineSnapshot = model.getSnapshot();
      lastObservedDateKey = dateKey;
      lastObservedData = result.data;
    }

    const alerts = model.getAlerts();
    const confidence = model.getConfidence();
    const projection = model.getTimeToLoss();
    ui.updateModelOutputs(model.getState());
    ui.updateDiagnostics({ alerts, confidence, projection, sourceLabel: result.sourceLabel });
    ui.setChartWindow(30);
    ui.updateCharts(model.getHistory());
    ui.updateDailySummary(model.getSummary(result.data, { alerts, confidence, projection }));
    ui.updateSimulationSource({ sourceLabel: result.sourceLabel });
    ui.updateScenarioStatus('Live baseline');
  }
}

async function simulateDays(days) {
  if (baselineSnapshot) {
    model.setSnapshot(baselineSnapshot);
  }

  const seriesResult = await weather.fetchDailySeries(days);
  const series = seriesResult.series || [];
  const sourceLabel = seriesResult.sourceLabel;
  const filteredSeries = series.filter((day) => {
    const dayKey = toDateKey(day.date);
    return !lastObservedDateKey || dayKey !== lastObservedDateKey;
  });

  filteredSeries.forEach((day) => {
    model.applyDailyObservation(day, sourceLabel);
  });

  model.setDataContext({
    sourceLabel,
    ageHours: null,
    isFallback: sourceLabel === 'Simulated',
    isForecast: sourceLabel === 'Forecast',
    isScenario: false,
    isStale: sourceLabel === 'Simulated'
  });

  const alerts = model.getAlerts();
  const confidence = model.getConfidence();
  const projection = model.getTimeToLoss();

  ui.updateModelOutputs(model.getState());
  ui.updateDiagnostics({ alerts, confidence, projection, sourceLabel });
  ui.setChartWindow(days);
  ui.updateCharts(model.getHistory());
  const lastDay = filteredSeries[filteredSeries.length - 1] || series[series.length - 1];
  if (lastDay) {
    ui.updateDailySummary(model.getSummary(lastDay, { alerts, confidence, projection }));
  }
  ui.updateSimulationSource(seriesResult);
}

ui.onRefresh(async () => {
  await loadCurrentConditions(true);
});

ui.onSimulate(async (days) => {
  await simulateDays(days);
});

ui.onScenarioSimulate(async (days, scenario) => {
  if (baselineSnapshot) {
    model.setSnapshot(baselineSnapshot);
  }
  const scenarioResult = await weather.fetchScenarioSeries(
    days,
    scenario,
    lastObservedData
  );
  const series = scenarioResult.series || [];
  const filteredSeries = series.filter((day) => {
    const dayKey = toDateKey(day.date);
    return !lastObservedDateKey || dayKey !== lastObservedDateKey;
  });

  filteredSeries.forEach((day) => {
    model.applyDailyObservation(day, scenarioResult.sourceLabel);
  });

  model.setDataContext({
    sourceLabel: scenarioResult.sourceLabel,
    ageHours: null,
    isFallback: true,
    isForecast: false,
    isScenario: true,
    isStale: true
  });

  const alerts = model.getAlerts();
  const confidence = model.getConfidence();
  const projection = model.getTimeToLoss();

  const lastDay = filteredSeries[filteredSeries.length - 1] || series[series.length - 1];
  if (lastDay) {
    ui.updateCurrentConditions({
      ok: true,
      data: {
        ...lastDay,
        humidity: lastObservedData?.humidity ?? 0,
        pressure: lastObservedData?.pressure ?? 0,
        timezoneAbbr: lastObservedData?.timezoneAbbr || 'UTC'
      }
    });
    ui.updateDailySummary(model.getSummary(lastDay, { alerts, confidence, projection }));
  }

  ui.updateModelOutputs(model.getState());
  ui.updateDiagnostics({
    alerts,
    confidence,
    projection,
    sourceLabel: scenarioResult.sourceLabel
  });
  ui.setChartWindow(7);
  ui.updateCharts(model.getHistory());
  ui.updateSimulationSource({ sourceLabel: scenarioResult.sourceLabel });
  ui.updateScenarioStatus(scenarioResult.sourceLabel.replace('Scenario: ', ''));
  ui.updateDataStatus({ mode: 'scenario' });
});

ui.onScenarioSelect(async (scenario) => {
  await ui.onScenarioSimulateCallback?.(7, scenario);
});

loadCurrentConditions();
