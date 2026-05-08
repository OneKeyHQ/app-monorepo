import {
  TOKEN_SELECTOR_PERF_MARK_NAME,
  markTokenSelectorPerfMeasure,
  startTokenSelectorPerfMeasure,
} from './tokenSelectorPerf';

type IPerfMarkBufferGlobal = {
  __perfMarkBuffer?: Array<{
    name: string;
    detail?: {
      durationMs?: number;
      layout?: string;
      phase?: string;
      resultCount?: number;
    };
  }>;
};

function getPerfGlobal() {
  return globalThis as unknown as IPerfMarkBufferGlobal;
}

const originalPerfMonitorEnabled = process.env.PERF_MONITOR_ENABLED;

describe('tokenSelectorPerf', () => {
  afterEach(() => {
    if (originalPerfMonitorEnabled === undefined) {
      delete process.env.PERF_MONITOR_ENABLED;
    } else {
      process.env.PERF_MONITOR_ENABLED = originalPerfMonitorEnabled;
    }
    delete getPerfGlobal().__perfMarkBuffer;
  });

  it('does not measure when perf monitor is disabled', () => {
    delete process.env.PERF_MONITOR_ENABLED;

    expect(startTokenSelectorPerfMeasure()).toBeUndefined();
    markTokenSelectorPerfMeasure(undefined, {
      layout: 'desktop',
      phase: 'active-tab',
      resultCount: 3,
    });

    expect(getPerfGlobal().__perfMarkBuffer).toBeUndefined();
  });

  it('buffers token selector phase duration when perf monitor is enabled', () => {
    process.env.PERF_MONITOR_ENABLED = '1';

    const startTime = startTokenSelectorPerfMeasure();
    markTokenSelectorPerfMeasure(startTime, {
      layout: 'desktop',
      phase: 'active-tab',
      activeTab: 'all',
      resultCount: 3,
    });

    const buffer = getPerfGlobal().__perfMarkBuffer;
    expect(buffer).toHaveLength(1);
    expect(buffer?.[0]?.name).toBe(TOKEN_SELECTOR_PERF_MARK_NAME);
    expect(buffer?.[0]?.detail).toMatchObject({
      layout: 'desktop',
      phase: 'active-tab',
      resultCount: 3,
    });
    expect(typeof buffer?.[0]?.detail?.durationMs).toBe('number');
  });
});
