import type { Analytics } from '@onekeyhq/shared/src/analytics';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger.web-only';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';

describe('SwapLowSlippageWarningScene', () => {
  let trackEvent: jest.MockedFunction<Analytics['trackEvent']>;

  async function flushWebLazyLoggerTimers() {
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    trackEvent = jest.fn();
    appGlobals.$analytics = {
      trackEvent,
    } as unknown as Analytics;
    loggerConfig.updateRuntimeConfig({
      enabled: {},
      colorfulLog: false,
      highlightDurationGt: '100',
    });
  });

  afterEach(() => {
    appGlobals.$analytics = undefined;
    jest.useRealTimers();
  });

  it('reports the warning show and quick-set events with registered names', async () => {
    defaultLogger.swap.swapLowSlippageWarning.swapLowSlippageWarningShow({
      slippage: 0.5,
      swapProvider: 'lifi',
    });
    defaultLogger.swap.swapLowSlippageWarning.swapLowSlippageWarningQuickSet({
      fromSlippage: 0.5,
      toSlippage: 1,
      swapProvider: 'lifi',
    });
    await flushWebLazyLoggerTimers();

    expect(trackEvent).toHaveBeenNthCalledWith(
      1,
      'swapLowSlippageWarningShow',
      {
        slippage: 0.5,
        swapProvider: 'lifi',
      },
    );
    expect(trackEvent).toHaveBeenNthCalledWith(
      2,
      'swapLowSlippageWarningQuickSet',
      {
        fromSlippage: 0.5,
        toSlippage: 1,
        swapProvider: 'lifi',
      },
    );
  });
});
