import { calcSwapStockPercentageAmount } from './useSwapStockTradeInputs';

jest.mock('@onekeyhq/components', () => ({ Toast: { message: jest.fn() } }));
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));
jest.mock('@onekeyhq/shared/src/config/presetNetworks', () => ({
  presetNetworksMap: {},
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({}));
jest.mock('@onekeyhq/shared/src/locale', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/numberUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  equalTokenNoCaseSensitive: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils', () => ({
  buildSwapSelectedTokensColdStartAccountKey: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/utils/validateAmountInput', () => ({
  validateAmountInput: jest.fn(() => true),
}));
jest.mock('../utils/swapBalanceDisplayCacheUtils', () => ({}));
jest.mock('../utils/swapRateDifferenceUtils', () => ({}));
jest.mock('./swapStockFiatValueUtils', () => ({}));
jest.mock('./swapStockPayTokenUtils', () => ({}));
jest.mock('./swapStockQuoteUtils', () => ({}));
jest.mock('./swapStockChannelUtils', () => ({}));
jest.mock('./useSwapStockChannel', () => ({}));
jest.mock('./useSwapStockSelectedBalanceSync', () => ({}));

describe('calcSwapStockPercentageAmount', () => {
  it('deducts native gas reserve before applying a percentage stage', () => {
    expect(
      calcSwapStockPercentageAmount({
        balanceParsed: '1',
        isNative: true,
        reserveGas: '0.2',
        stage: 50,
      }).toFixed(),
    ).toBe('0.4');
  });

  it('keeps non-native percentages based on the full balance', () => {
    expect(
      calcSwapStockPercentageAmount({
        balanceParsed: '1',
        isNative: false,
        reserveGas: '0.2',
        stage: 50,
      }).toFixed(),
    ).toBe('0.5');
  });

  it('matches max semantics at 100% after reserving native gas', () => {
    expect(
      calcSwapStockPercentageAmount({
        balanceParsed: '1',
        isNative: true,
        reserveGas: '0.2',
        stage: 100,
      }).toFixed(),
    ).toBe('0.8');
  });
});
