import { Analytics } from '@onekeyhq/shared/src/analytics';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger.web-only';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

describe('SwapHistoryTradeAgainScene', () => {
  let analytics: Analytics;

  beforeEach(() => {
    jest.useFakeTimers();
    analytics = new Analytics();
    appGlobals.$analytics = analytics;
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

  it('reports the requested trade context without account or transaction data', async () => {
    const trackEvent = jest.spyOn(analytics, 'trackEvent').mockImplementation();
    const event = {
      status: ESwapTxHistoryStatus.REFUNDED,
      swapType: 'bridge' as const,
      fromTokenSymbol: 'ETH',
      fromNetworkId: 'evm--1',
      toTokenSymbol: 'USDC',
      toNetworkId: 'evm--137',
      source: 'swapHistoryDetail' as const,
      accountId: 'must-not-be-reported',
      contractAddress: 'must-not-be-reported',
      orderId: 'must-not-be-reported',
      amount: 'must-not-be-reported',
    };
    defaultLogger.swap.swapHistoryTradeAgain.swapHistoryTradeAgainClick(event);
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('swapHistoryTradeAgainClick', {
      status: ESwapTxHistoryStatus.REFUNDED,
      swapType: 'bridge',
      fromTokenSymbol: 'ETH',
      fromNetworkId: 'evm--1',
      toTokenSymbol: 'USDC',
      toNetworkId: 'evm--137',
      source: 'swapHistoryDetail',
    });
  });
});
