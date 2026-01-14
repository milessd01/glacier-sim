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

function toDateKey(date) {
  if (!(date instanceof Date)) return null;
  return date.toISOString().slice(0, 10);
}

async function loadCurrentConditions(reset = false) {
  const result = await weather.fetchCurrent();
  ui.updateCurrentConditions(result);
  ui.updateDataStatus(result);

  if (result.ok && result.data) {
    const dateKey = toDateKey(result.data.date);
    const shouldAdvance = dateKey && dateKey !== lastObservedDateKey;
    if (reset || shouldAdvance) {
      model.resetWithObservation(result.data, result.sourceLabel);
      baselineSnapshot = model.getSnapshot();
      lastObservedDateKey = dateKey;
      lastObservedData = result.data;
    }

    ui.updateModelOutputs(model.getState());
    ui.setChartWindow(30);
    ui.updateCharts(model.getHistory());
    ui.updateDailySummary(model.getSummary(result.data));
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

  ui.updateModelOutputs(model.getState());
  ui.setChartWindow(days);
  ui.updateCharts(model.getHistory());
  const lastDay = filteredSeries[filteredSeries.length - 1] || series[series.length - 1];
  if (lastDay) {
    ui.updateDailySummary(model.getSummary(lastDay));
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
    ui.updateDailySummary(model.getSummary(lastDay));
  }

  ui.updateModelOutputs(model.getState());
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
