const DIRECT_TIMING_FIELDS = [
  'actualDuration',
  'activeStateToPaintMs',
  'approximateRpcOverheadMs',
  'bgRpcMs',
  'bgTotalMs',
  'buildMs',
  'commitToPaintMs',
  'mutexWaitMs',
  'selectionStateToPaintMs',
  'totalMs',
  'workMs',
];

const STATE_CHANGE_TIMING_FIELDS = [
  'activeStateToProviderCommitMs',
  'activeStateToPaintMs',
  'selectionStateToProviderCommitMs',
  'selectionStateToPaintMs',
];

function percentile(values, ratio) {
  if (!values.length) return undefined;
  const sorted = [...values].toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function summarizeTimingValues(timingValues) {
  const summary = {};
  for (const [field, values] of Object.entries(timingValues)) {
    if (values.length) {
      summary[field] = {
        count: values.length,
        max: Math.max(...values),
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
      };
    }
  }
  return summary;
}

function collectEventTimingSummary(events) {
  const timings = {};
  const timingsByEvent = {};
  const record = (event, field, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    timings[field] ||= [];
    timings[field].push(value);
    timingsByEvent[event] ||= {};
    timingsByEvent[event][field] ||= [];
    timingsByEvent[event][field].push(value);
  };

  for (const event of events) {
    for (const field of DIRECT_TIMING_FIELDS) {
      record(event.event, field, event[field]);
    }
    for (const [stage, value] of Object.entries(event.stageMs || {})) {
      record(event.event, `stageMs.${stage}`, value);
    }
    for (const stateChange of event.stateChanges || []) {
      for (const field of STATE_CHANGE_TIMING_FIELDS) {
        record(event.event, field, stateChange[field]);
      }
    }
  }

  return {
    timingSummary: summarizeTimingValues(timings),
    timingSummaryByEvent: Object.fromEntries(
      Object.entries(timingsByEvent).map(([event, values]) => [
        event,
        summarizeTimingValues(values),
      ]),
    ),
  };
}

function evaluateFanoutBudgets(summary, definitions) {
  return definitions.map((definition) => {
    const observed = summary.fanout[definition.fanout]?.[definition.field];
    return {
      ...definition,
      observed,
      passed: typeof observed === 'number' && observed <= definition.limit,
    };
  });
}

function evaluateEventCountBudgets(summary, definitions) {
  return definitions.map((definition) => {
    const observed = summary.eventCounts[definition.event];
    return {
      ...definition,
      observed,
      passed: typeof observed === 'number' && observed <= definition.limit,
    };
  });
}

module.exports = {
  collectEventTimingSummary,
  evaluateEventCountBudgets,
  evaluateFanoutBudgets,
  percentile,
  summarizeTimingValues,
};
