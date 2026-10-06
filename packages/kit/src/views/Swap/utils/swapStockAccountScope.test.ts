import {
  buildSwapStockAccountScopeKey,
  resolveSwapStockDeriveType,
} from './swapStockAccountScope';

describe('swapStockAccountScope', () => {
  it('uses selected derive only for the selected Stock network', () => {
    expect(
      resolveSwapStockDeriveType({
        activeDeriveType: 'default',
        networkDefaultDeriveType: 'default',
        networkId: 'evm--1',
        selectedDeriveType: 'ledgerLive',
        stockNetworkId: 'evm--1',
      }),
    ).toBe('ledgerLive');
    expect(
      resolveSwapStockDeriveType({
        activeDeriveType: 'default',
        networkDefaultDeriveType: 'default',
        networkId: 'evm--56',
        selectedDeriveType: 'ledgerLive',
        stockNetworkId: 'evm--1',
      }),
    ).toBe('default');
  });

  it('falls back in a deterministic order and scopes account requests', () => {
    expect(
      resolveSwapStockDeriveType({
        activeDeriveType: 'default',
        networkId: 'evm--1',
        selectedAccountDeriveType: 'ledgerLive',
        stockNetworkId: 'evm--1',
      }),
    ).toBe('ledgerLive');
    expect(
      buildSwapStockAccountScopeKey({
        accountId: 'account-1',
        deriveType: 'ledgerLive',
        networkId: 'evm--1',
      }),
    ).toBe(':account-1:evm--1:ledgerLive');
  });
});
