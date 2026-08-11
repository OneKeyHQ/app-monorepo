import {
  clearTradingViewNativeDebugEvents,
  emitTradingViewNativeDebugEvent,
  getTradingViewNativeDebugErrorMessage,
  getTradingViewNativeDebugEvents,
  subscribeTradingViewNativeDebugEvents,
} from './tradingViewNativeDebugLogger';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: true,
    isWeb: true,
  },
}));

const mockPlatformEnv = jest.requireMock('@onekeyhq/shared/src/platformEnv')
  .default as {
  isDev: boolean;
  isWeb: boolean;
};

describe('TradingViewNative debug event logger', () => {
  beforeEach(() => {
    mockPlatformEnv.isDev = true;
    mockPlatformEnv.isWeb = true;
    clearTradingViewNativeDebugEvents();
  });

  it('keeps a bounded chronological event list and notifies subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeTradingViewNativeDebugEvents(listener);

    for (let index = 0; index < 260; index += 1) {
      emitTradingViewNativeDebugEvent({
        details: { index },
        name: `history.response.${index}`,
      });
    }

    const events = getTradingViewNativeDebugEvents();
    expect(events).toHaveLength(250);
    expect(events[0]).toEqual(
      expect.objectContaining({
        details: { index: 10 },
        name: 'history.response.10',
      }),
    );
    expect(events.at(-1)?.name).toBe('history.response.259');
    expect(listener).toHaveBeenCalledTimes(260);

    unsubscribe();
  });

  it('does not collect outside a local Web development build', () => {
    mockPlatformEnv.isDev = false;
    emitTradingViewNativeDebugEvent({ name: 'production-event' });
    mockPlatformEnv.isDev = true;
    mockPlatformEnv.isWeb = false;
    emitTradingViewNativeDebugEvent({ name: 'native-event' });

    expect(getTradingViewNativeDebugEvents()).toEqual([]);
  });

  it('normalizes error values for safe display', () => {
    expect(getTradingViewNativeDebugErrorMessage(new Error('failed'))).toBe(
      'failed',
    );
    expect(getTradingViewNativeDebugErrorMessage('offline')).toBe('offline');
  });
});
