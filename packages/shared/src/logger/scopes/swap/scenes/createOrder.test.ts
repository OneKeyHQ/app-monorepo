import { EDeviceType } from '@onekeyfe/hd-shared';

import type { Analytics } from '@onekeyhq/shared/src/analytics';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger.web-only';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';

import { ESwapEventAPIStatus } from './swapEstimateFee';

describe('CreateOrderScene', () => {
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

  // OK-62642: the swap completion event carries the wallet type and the
  // hardware model (raw device type) so hardware usage can be attributed.
  it('reports walletType and deviceType on swapCreateOrder without addresses', async () => {
    defaultLogger.swap.createSwapOrder.swapCreateOrder({
      status: ESwapEventAPIStatus.SUCCESS,
      swapType: 'swap',
      slippage: '0.5',
      sourceChain: 'evm--1',
      receivedChain: 'evm--1',
      sourceTokenSymbol: 'ETH',
      receivedTokenSymbol: 'USDC',
      swapProvider: 'lifi',
      swapProviderName: 'LI.FI',
      feeType: '0',
      isFirstTime: false,
      createFrom: 'swap',
      fromTokenAmount: '1',
      toTokenAmount: '2000',
      fromAddress: '0xfrom',
      toAddress: '0xto',
      walletType: 'hw',
      deviceType: EDeviceType.Pro2,
    });
    await flushWebLazyLoggerTimers();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    const [eventName, payload] = trackEvent.mock.calls[0];
    expect(eventName).toBe('swapCreateOrder');
    expect(payload).toEqual(
      expect.objectContaining({
        walletType: 'hw',
        deviceType: 'pro2',
      }),
    );
    expect(payload).not.toHaveProperty('fromAddress');
    expect(payload).not.toHaveProperty('toAddress');
  });
});
