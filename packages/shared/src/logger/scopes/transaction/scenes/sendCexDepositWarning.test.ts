import type { Analytics } from '@onekeyhq/shared/src/analytics';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger.web-only';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';

describe('sendCexDepositWarning events', () => {
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
    defaultLogger.transaction.send.clearFlow();
    jest.useRealTimers();
  });

  it('reports show and action with sendFlowId and registered names', async () => {
    const sendFlowId = defaultLogger.transaction.send.startNewFlow();
    const context = {
      network: 'evm--1',
      tokenSymbol: 'DAI',
      exchange: 'binance',
      page: 'address' as const,
    };

    defaultLogger.transaction.send.sendCexDepositWarningShow(context);
    defaultLogger.transaction.send.sendCexDepositWarningAction({
      ...context,
      action: 'continue',
    });
    await flushWebLazyLoggerTimers();

    expect(trackEvent).toHaveBeenNthCalledWith(1, 'sendCexDepositWarningShow', {
      sendFlowId,
      ...context,
    });
    expect(trackEvent).toHaveBeenNthCalledWith(
      2,
      'sendCexDepositWarningAction',
      {
        sendFlowId,
        ...context,
        action: 'continue',
      },
    );
  });
});
