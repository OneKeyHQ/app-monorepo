import {
  completeTradingViewKlineFirstPaint,
  markTradingViewKlinePerf,
  resolveTradingViewKlineOptimizationMode,
  startTradingViewKlinePerfSession,
} from './tradingViewKlinePerf';

const mockDexTVFirstPaint = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      tradingView: {
        dexTVFirstPaint: (...args: unknown[]) => {
          mockDexTVFirstPaint(...args);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    appPlatform: 'desktop',
    isDev: true,
    isE2E: false,
    isJest: true,
  },
}));

type ITestPerfController = {
  mode: 'auto' | 'optimized' | 'baseline';
  sessions: Array<{
    mode: 'optimized' | 'baseline';
    marks: Record<string, number>;
    prefetchStatus: string;
    bootstrapStatus: string;
    firstPaint?: { durationMs: number };
  }>;
  reset: () => void;
};

function getPerfController() {
  return (
    globalThis as typeof globalThis & {
      __onekeyTradingViewKlinePerf: ITestPerfController;
    }
  ).__onekeyTradingViewKlinePerf;
}

describe('tradingViewKlinePerf', () => {
  let now = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(globalThis.performance, 'now').mockImplementation(() => now);
    const controller = getPerfController();
    controller.mode = 'auto';
    controller.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves the developer A/B setting and local benchmark override', () => {
    expect(
      resolveTradingViewKlineOptimizationMode({
        disabledByDevSettings: false,
      }),
    ).toBe('optimized');
    expect(
      resolveTradingViewKlineOptimizationMode({
        disabledByDevSettings: true,
      }),
    ).toBe('baseline');

    getPerfController().mode = 'optimized';
    expect(
      resolveTradingViewKlineOptimizationMode({
        disabledByDevSettings: true,
      }),
    ).toBe('optimized');
  });

  it('records stage timings and reports one privacy-safe first-paint event', () => {
    const identity = {
      networkId: 'evm--1',
      tokenAddress: '0xAbC',
    };
    startTradingViewKlinePerfSession({ identity, mode: 'optimized' });

    now = 10;
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'prefetch_start',
      prefetchStatus: 'pending',
    });
    now = 90;
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'prefetch_end',
      prefetchStatus: 'completed',
      prefetchedCount: 299,
    });
    now = 120;
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'chart_mount',
    });
    now = 300;
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'chart_ready',
    });
    now = 340;
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'bootstrap',
      bootstrapStatus: 'sent',
    });
    now = 380;
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'history_ready',
    });
    now = 420;
    completeTradingViewKlineFirstPaint({
      identity,
      mode: 'optimized',
      provider: 'onekey',
      requestId: 'request-1',
      interval: '1m',
      status: 'rendered',
      source: 'bootstrap',
      returnedCount: 299,
    });
    completeTradingViewKlineFirstPaint({
      identity,
      mode: 'optimized',
      provider: 'onekey',
      requestId: 'request-1',
      interval: '1m',
      status: 'rendered',
      source: 'bootstrap',
      returnedCount: 299,
    });

    expect(mockDexTVFirstPaint).toHaveBeenCalledTimes(1);
    expect(mockDexTVFirstPaint).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 420,
        chartReadyMs: 300,
        historyReadyMs: 380,
        prefetchDurationMs: 80,
        prefetchLeadMs: 110,
        optimizationMode: 'optimized',
        prefetchStatus: 'completed',
        bootstrapStatus: 'sent',
        provider: 'onekey',
        source: 'bootstrap',
      }),
    );

    const [session] = getPerfController().sessions;
    expect(session.firstPaint?.durationMs).toBe(420);
    expect(JSON.stringify(session)).not.toContain(identity.networkId);
    expect(JSON.stringify(session)).not.toContain(identity.tokenAddress);
  });

  it('keeps terminal prefetch state when the chart subscribes after navigation', () => {
    const identity = { networkId: 'evm--1', tokenAddress: '0xabc' };
    startTradingViewKlinePerfSession({ identity, mode: 'optimized' });
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'prefetch_end',
      prefetchStatus: 'completed',
    });
    markTradingViewKlinePerf({
      identity,
      mode: 'optimized',
      mark: 'prefetch_start',
      prefetchStatus: 'pending',
    });

    expect(getPerfController().sessions[0].prefetchStatus).toBe('completed');
  });
});
