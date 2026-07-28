import type { Analytics } from '@onekeyhq/shared/src/analytics';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
// Jest maps the generic logger entry to the sync implementation for regular tests.
// Import the web-only wrapper explicitly so this test still covers lazy queue flushing.
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger.web-only';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import type { ISwapOrderLongPendingWarningPayload } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

describe('SwapOrderLongPendingWarningScene', () => {
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

  it('reports the long pending warning event to analytics with the full payload', async () => {
    const payload: ISwapOrderLongPendingWarningPayload = {
      orderId: 'order-analytics',
      pendingDuration: 5430,
      swapTxHash: '0xtx',
      createdTime: 1_000_000,
      swapType: ESwapTabSwitchType.BRIDGE,
      provider: 'lifi',
      fromNetwork: 'evm--1',
      toNetwork: 'evm--137',
      fromTokenSymbol: 'ETH',
      fromTokenAddress: '0xeth',
      fromTokenAmount: '1.5',
      fromTokenFiatValue: '3000',
      toTokenSymbol: 'USDC',
      toTokenAddress: '0xusdc',
      toTokenAmount: '3000',
      slippage: '',
      feeFiatValue: '1.23',
      walletType: '',
      protocol: EProtocolOfExchange.SWAP,
      status: ESwapTxHistoryStatus.PENDING,
      sourceChain: 'evm--1',
      receivedChain: 'evm--137',
      sourceTokenSymbol: 'ETH',
      receivedTokenSymbol: 'USDC',
      swapProvider: 'lifi',
      swapProviderName: 'LI.FI',
      orderType: EProtocolOfExchange.SWAP,
      quoteToTokenAmount: '3000',
      router: '',
      feeType: '0.875',
      duration: 5430,
    };

    defaultLogger.swap.swapOrderLongPendingWarning.swapOrderLongPendingWarning(
      payload,
    );
    await flushWebLazyLoggerTimers();

    expect(trackEvent).toHaveBeenCalledWith(
      'swapOrderLongPendingWarning',
      payload,
    );
  });
});
