import { WeatherService } from './weather.js';
import { GlacierModel } from './model.js';
import { DashboardUI } from './ui.js';

const GLACIERS = [
  {
    id: 'mendenhall',
    displayName: 'Mendenhall Glacier',
    latitude: 58.4,
    longitude: -134.4,
    region: 'Juneau, Alaska',
    info: {
      subtitle: 'History, context, and fast facts.',
      origin: [
        'Mendenhall Glacier (also known by Tlingit names, and once called "Auk Glacier") is a 13 to 13.6 mile long valley glacier in the Mendenhall Valley near Juneau, Alaska.',
        'It flows out of the Juneau Icefield, a roughly 1,500 square mile icefield that feeds dozens of glaciers, and terminates at Mendenhall Lake inside the federally managed Mendenhall Glacier Recreation Area within Tongass National Forest.',
        'The modern name honors Thomas Corwin Mendenhall (U.S. Coast and Geodetic Survey). John Muir referred to it as "Auk Glacier" in the late 1800s.'
      ],
      timeline: [
        'Little Ice Age peak to modern retreat: maximum advance occurred around the mid-1700s; retreat begins after that period as climate conditions shift.',
        'Mendenhall Lake began forming in the early 1900s as the glacier pulled back; multiple sources note a benchmark around 1929 when the lake was created/exposed.',
        'Mapped terminus positions show roughly 5,513 meters (18,087 feet / 3.4 miles) of centerline retreat over 261 years (1760 to 2021), with the fastest retreat rates in 2007 to 2011 as calving accelerated.',
        'In November 2025, researchers reported the glacier was no longer functionally touching Mendenhall Lake, marking a new phase of retreat.'
      ],
      facts: [
        'It shapes Juneau\'s watershed: the glacier feeds Mendenhall Lake and the Mendenhall River, influencing water levels and seasonal flow.',
        'Ice caves exist but are unstable and change year to year. Public safety warnings are common because roofs thin and can collapse.',
        'It is one of Alaska\'s most visited easy-access glacier destinations, with visitor counts historically in the hundreds of thousands per year.'
      ],
      matters: [
        'Mendenhall is a visible, local climate signal. Retreat after the Little Ice Age maximum has steepened in recent decades tied to regional warming trends.',
        'Retreat changes what visitors can see and access, and researchers expect the glacier may retreat out of view from the visitor center\'s classic vantage point around 2050.',
        'Juneau faces outburst flood risk tied to changes in glacier geometry and the formation of the ice-dammed Suicide Basin.'
      ]
    }
  },
  {
    id: 'hubbard',
    displayName: 'Hubbard Glacier',
    latitude: 60.3139,
    longitude: -139.3708,
    region: 'Yakutat Bay, Alaska',
    provider: 'nws-hybrid',
    info: {
      subtitle: 'History, context, and fast facts.',
      origin: [
        'Hubbard Glacier is a massive tidewater glacier flowing from the Saint Elias Mountains into Disenchantment Bay and Russell Fjord near Yakutat Bay.',
        'It is commonly cited as the largest tidewater glacier in North America, with a very wide, tall calving front.',
        'Named for Gardiner Hubbard, it remains one of Alaska\'s most active, glacier-fed marine systems.'
      ],
      timeline: [
        'Hubbard has been in a long-term advancing phase for much of the 20th century, periodically surging forward into fjord waters.',
        'Advances have occasionally dammed Russell Fjord, briefly turning it into a freshwater lake before catastrophic outburst.',
        'The glacier continues to calve heavily while still maintaining overall forward motion compared to many retreating glaciers.'
      ],
      facts: [
        'Its calving front is several miles wide and rises well above the waterline, making it visually dramatic and hazardous to approach.',
        'Hubbard\'s growth can temporarily block fjord circulation, affecting local ecosystems and navigation.',
        'It is fed by multiple tributary glaciers and deep snowfall from the surrounding mountains.'
      ],
      matters: [
        'Hubbard is a useful counterexample to widespread retreat, showing that local dynamics and supply can still drive advance.',
        'Calving activity and fjord blockages can change water circulation and marine habitat conditions.',
        'Its behavior helps scientists study tidewater glacier stability and surge cycles.'
      ]
    }
  },
  {
    id: 'columbia',
    displayName: 'Columbia Glacier',
    latitude: 61.1,
    longitude: -147.0,
    region: 'Prince William Sound, Alaska',
    provider: 'nws-hybrid',
    info: {
      subtitle: 'History, context, and fast facts.',
      origin: [
        'Columbia Glacier is a large tidewater glacier in Prince William Sound, flowing out of the Chugach Mountains.',
        'It is one of the most studied retreating tidewater glaciers in North America.',
        'Its terminus lies in a fjord with deep water that supports rapid calving when the glacier thins.'
      ],
      timeline: [
        'The glacier began a rapid retreat phase in the late 20th century after becoming unstable in deep water.',
        'Retreat rates increased as the terminus pulled back into deeper fjord sections, accelerating calving.',
        'Ongoing monitoring tracks continued thinning and retreat, making it a benchmark for tidewater glacier change.'
      ],
      facts: [
        'Columbia Glacier can produce large icebergs that drift into Prince William Sound shipping lanes.',
        'The retreat has exposed new fjord waters and changed local sediment and habitat dynamics.',
        'It is frequently referenced in glacier stability and sea-level rise research.'
      ],
      matters: [
        'Columbia\'s rapid retreat offers clear evidence of how marine-terminating glaciers can destabilize quickly.',
        'Iceberg production impacts navigation and coastal ecosystems in Prince William Sound.',
        'Its data record helps improve projections for other tidewater glaciers.'
      ]
    }
  }
];

const ui = new DashboardUI();

const glacierState = GLACIERS.reduce((acc, glacier) => {
  acc[glacier.id] = {
    glacier,
    weather: new WeatherService({
      latitude: glacier.latitude,
      longitude: glacier.longitude,
      name: glacier.displayName,
      timezone: 'auto',
      provider: glacier.provider
    }),
    model: new GlacierModel(),
    baselineSnapshot: null,
    lastObservedDateKey: null,
    lastObservedData: null,
    scenarioMode: false,
    scenarioLabel: 'Live baseline',
    currentScenario: null,
    chartWindowDays: 30,
    lastSimulationSource: 'Observed',
    lastStatus: { ok: false, isStale: true },
    lastSummaryData: null,
    lastScenarioDisplayData: null
  };
  return acc;
}, {});

let activeGlacierId = GLACIERS[0].id;

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

function getActiveState() {
  return glacierState[activeGlacierId];
}

async function loadCurrentConditions(reset = false, forceFetch = false) {
  const state = getActiveState();
  const result = await state.weather.fetchCurrent({ force: forceFetch });
  const ageHours = result.data?.date
    ? (Date.now() - result.data.date.getTime()) / 3600000
    : null;
  const isStale = typeof ageHours === 'number' && ageHours > 2;

  ui.updateCurrentConditions(result);
  ui.updateDataStatus({ ...result, isStale });
  state.lastStatus = { ok: result.ok, isStale };

  if (result.ok && result.data) {
    const dateKey = toDateKey(result.data.date);
    const shouldAdvance = dateKey && dateKey !== state.lastObservedDateKey;
    state.lastObservedData = result.data;
    if (!state.scenarioMode) {
      state.lastSummaryData = result.data;
    }
    if (reset || shouldAdvance) {
      state.model.resetWithObservation(result.data, result.sourceLabel);
      state.model.setDataContext({
        sourceLabel: result.sourceLabel,
        ageHours,
        isFallback: false,
        isForecast: false,
        isScenario: false,
        isStale
      });
      state.baselineSnapshot = state.model.getSnapshot();
      state.lastObservedDateKey = dateKey;
      state.scenarioMode = false;
      state.scenarioLabel = 'Live baseline';
      state.currentScenario = null;
      state.lastScenarioDisplayData = null;
    }

    const alerts = state.model.getAlerts();
    const confidence = state.model.getConfidence();
    const projection = state.model.getTimeToLoss();

    ui.updateModelOutputs(state.model.getState());
    ui.updateDiagnostics({
      alerts,
      confidence,
      projection,
      sourceLabel: result.sourceLabel
    });
    ui.setChartWindow(state.chartWindowDays);
    ui.updateCharts(state.model.getHistory());
    ui.updateDailySummary(state.model.getSummary(result.data, { alerts, confidence, projection }));
    ui.updateSimulationSource({ sourceLabel: result.sourceLabel });
    state.lastSimulationSource = result.sourceLabel;
    ui.updateScenarioStatus(state.scenarioLabel);
  }
}

async function simulateDays(days) {
  const state = getActiveState();
  if (state.baselineSnapshot) {
    state.model.setSnapshot(state.baselineSnapshot);
  }

  const seriesResult = await state.weather.fetchDailySeries(days);
  const series = seriesResult.series || [];
  const sourceLabel = seriesResult.sourceLabel;
  const filteredSeries = series.filter((day) => {
    const dayKey = toDateKey(day.date);
    return !state.lastObservedDateKey || dayKey !== state.lastObservedDateKey;
  });

  filteredSeries.forEach((day) => {
    state.model.applyDailyObservation(day, sourceLabel);
  });

  state.model.setDataContext({
    sourceLabel,
    ageHours: null,
    isFallback: sourceLabel === 'Simulated',
    isForecast: sourceLabel === 'Forecast',
    isScenario: false,
    isStale: sourceLabel === 'Simulated'
  });

  const alerts = state.model.getAlerts();
  const confidence = state.model.getConfidence();
  const projection = state.model.getTimeToLoss();

  state.chartWindowDays = days;
  state.scenarioMode = false;
  state.scenarioLabel = 'Live baseline';
  state.currentScenario = null;
  state.lastScenarioDisplayData = null;
  state.lastSimulationSource = sourceLabel;
  state.lastStatus = { ok: true, isStale: false };

  ui.updateModelOutputs(state.model.getState());
  ui.updateDiagnostics({ alerts, confidence, projection, sourceLabel });
  ui.setChartWindow(days);
  ui.updateCharts(state.model.getHistory());
  const lastDay = filteredSeries[filteredSeries.length - 1] || series[series.length - 1];
  if (lastDay) {
    state.lastSummaryData = lastDay;
    ui.updateDailySummary(state.model.getSummary(lastDay, { alerts, confidence, projection }));
  }
  ui.updateSimulationSource(seriesResult);
  ui.updateScenarioStatus(state.scenarioLabel);
  ui.updateDataStatus(state.lastStatus);
}

async function simulateScenario(days, scenario) {
  const state = getActiveState();
  if (state.baselineSnapshot) {
    state.model.setSnapshot(state.baselineSnapshot);
  }
  const scenarioResult = await state.weather.fetchScenarioSeries(
    days,
    scenario,
    state.lastObservedData
  );
  const series = scenarioResult.series || [];
  const filteredSeries = series.filter((day) => {
    const dayKey = toDateKey(day.date);
    return !state.lastObservedDateKey || dayKey !== state.lastObservedDateKey;
  });

  filteredSeries.forEach((day) => {
    state.model.applyDailyObservation(day, scenarioResult.sourceLabel);
  });

  state.model.setDataContext({
    sourceLabel: scenarioResult.sourceLabel,
    ageHours: null,
    isFallback: true,
    isForecast: false,
    isScenario: true,
    isStale: true
  });

  const alerts = state.model.getAlerts();
  const confidence = state.model.getConfidence();
  const projection = state.model.getTimeToLoss();

  const lastDay = filteredSeries[filteredSeries.length - 1] || series[series.length - 1];
  if (lastDay) {
    state.lastSummaryData = lastDay;
    state.lastScenarioDisplayData = {
      ...lastDay,
      humidity: state.lastObservedData?.humidity ?? 0,
      pressure: state.lastObservedData?.pressure ?? 0,
      timezoneAbbr: state.lastObservedData?.timezoneAbbr || 'UTC'
    };
    ui.updateCurrentConditions({
      ok: true,
      data: {
        ...state.lastScenarioDisplayData
      }
    });
    ui.updateDailySummary(state.model.getSummary(lastDay, { alerts, confidence, projection }));
  }

  state.chartWindowDays = 7;
  state.scenarioMode = true;
  state.scenarioLabel = scenarioResult.sourceLabel.replace('Scenario: ', '');
  state.currentScenario = scenario;
  state.lastSimulationSource = scenarioResult.sourceLabel;

  ui.updateModelOutputs(state.model.getState());
  ui.updateDiagnostics({
    alerts,
    confidence,
    projection,
    sourceLabel: scenarioResult.sourceLabel
  });
  ui.setChartWindow(7);
  ui.updateCharts(state.model.getHistory());
  ui.updateSimulationSource({ sourceLabel: scenarioResult.sourceLabel });
  ui.updateScenarioStatus(state.scenarioLabel);
  ui.updateDataStatus({ mode: 'scenario' });
}

function renderActiveGlacier() {
  const state = getActiveState();
  ui.updateGlacierHeader(state.glacier);
  ui.updateInfoContent(state.glacier);
  if (state.scenarioMode && state.lastScenarioDisplayData) {
    ui.updateCurrentConditions({ ok: true, data: state.lastScenarioDisplayData });
  } else if (state.lastObservedData) {
    ui.updateCurrentConditions({ ok: true, data: state.lastObservedData });
  }
  ui.updateScenarioStatus(state.scenarioLabel);
  ui.setChartWindow(state.chartWindowDays);
  ui.updateCharts(state.model.getHistory());

  const alerts = state.model.getAlerts();
  const confidence = state.model.getConfidence();
  const projection = state.model.getTimeToLoss();
  ui.updateModelOutputs(state.model.getState());
  ui.updateDiagnostics({
    alerts,
    confidence,
    projection,
    sourceLabel: state.lastSimulationSource
  });
  ui.updateSimulationSource({ sourceLabel: state.lastSimulationSource });

  if (state.lastSummaryData) {
    ui.updateDailySummary(
      state.model.getSummary(state.lastSummaryData, { alerts, confidence, projection })
    );
  }

  if (state.scenarioMode) {
    ui.updateDataStatus({ mode: 'scenario' });
    ui.setScenario(state.currentScenario);
  } else {
    ui.updateDataStatus(state.lastStatus);
    ui.setScenarioMode(false);
  }
}

ui.onRefresh(async () => {
  await loadCurrentConditions(true, true);
});

ui.onSimulate(async (days) => {
  await simulateDays(days);
});

ui.onScenarioSimulate(async (days, scenario) => {
  await simulateScenario(days, scenario);
});

ui.onScenarioSelect(async (scenario) => {
  await ui.onScenarioSimulateCallback?.(7, scenario);
});

ui.onGlacierChange(async (glacierId) => {
  if (!glacierState[glacierId]) return;
  activeGlacierId = glacierId;
  renderActiveGlacier();
  if (!glacierState[glacierId].lastObservedData) {
    await loadCurrentConditions(true, false);
  }
});

renderActiveGlacier();
loadCurrentConditions();
