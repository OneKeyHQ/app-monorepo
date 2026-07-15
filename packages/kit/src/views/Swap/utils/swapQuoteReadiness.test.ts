import {
  ESwapQuoteReadinessBlocker,
  getSwapQuoteReadiness,
} from './swapQuoteReadiness';

const readyInput = {
  networkSelectorReady: true,
  initialSelectedTokensSynced: true,
  accountSelectorStorageInitDone: true,
  accountSelectorActiveAccountInitDone: true,
  fromAddressInfoReady: true,
  toAddressInfoReady: true,
};

describe('getSwapQuoteReadiness', () => {
  it.each([
    [
      'network selector',
      'networkSelectorReady',
      ESwapQuoteReadinessBlocker.NetworkSelector,
    ],
    [
      'initial token sync',
      'initialSelectedTokensSynced',
      ESwapQuoteReadinessBlocker.InitialTokenSync,
    ],
    [
      'account storage init',
      'accountSelectorStorageInitDone',
      ESwapQuoteReadinessBlocker.AccountStorageInit,
    ],
    [
      'active account init',
      'accountSelectorActiveAccountInitDone',
      ESwapQuoteReadinessBlocker.ActiveAccountInit,
    ],
    [
      'from-address resolution',
      'fromAddressInfoReady',
      ESwapQuoteReadinessBlocker.FromAddressResolution,
    ],
    [
      'to-address resolution',
      'toAddressInfoReady',
      ESwapQuoteReadinessBlocker.ToAddressResolution,
    ],
  ] as const)('blocks while %s is pending', (_label, key, blocker) => {
    expect(
      getSwapQuoteReadiness({
        ...readyInput,
        [key]: false,
      }),
    ).toEqual({
      ready: false,
      blocker,
    });
  });

  it('reports the earliest blocker in boot order', () => {
    expect(
      getSwapQuoteReadiness({
        ...readyInput,
        networkSelectorReady: false,
        accountSelectorStorageInitDone: false,
        fromAddressInfoReady: false,
      }),
    ).toEqual({
      ready: false,
      blocker: ESwapQuoteReadinessBlocker.NetworkSelector,
    });
  });

  it('is ready after every asynchronous dependency resolves', () => {
    expect(getSwapQuoteReadiness(readyInput)).toEqual({
      ready: true,
      blocker: undefined,
    });
  });

  it('does not require an address when the no-wallet resolution is complete', () => {
    const noWalletResolution = {
      ...readyInput,
      fromAddressInfoReady: true,
      toAddressInfoReady: true,
    };

    expect(getSwapQuoteReadiness(noWalletResolution)).toEqual({
      ready: true,
      blocker: undefined,
    });
  });
});
