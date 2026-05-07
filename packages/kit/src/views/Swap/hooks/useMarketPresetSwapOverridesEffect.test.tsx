/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';
import type { IMarketPresetTokenContext } from '@onekeyhq/shared/types/swap/types';

import { useMarketPresetSwapOverridesEffect } from './useMarketPresetSwapOverridesEffect';

const mockSetSwapStepNetFeeLevel = jest.fn();
const mockSetSwapSlippageOverride = jest.fn();
const mockEqualTokenNoCaseSensitive = jest.fn((_params: unknown) => false);

let mockMarketPresetToken: IMarketPresetTokenContext | undefined;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap/atoms', () => ({
  useSwapProDirectionAtom: () => ['buy'],
  useSwapProSelectTokenAtom: () => [undefined],
  useSwapSelectFromTokenAtom: () => [undefined],
  useSwapSelectToTokenAtom: () => [undefined],
  useSwapSlippageOverrideAtom: () => [undefined, mockSetSwapSlippageOverride],
  useSwapStepNetFeeLevelAtom: () => [undefined, mockSetSwapStepNetFeeLevel],
  useSwapTypeSwitchAtom: () => ['swap'],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  equalTokenNoCaseSensitive: (params: unknown) =>
    mockEqualTokenNoCaseSensitive(params),
}));

jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSwapOverrides',
  () => ({
    loadMarketPresetSwapOverrides: jest.fn(),
  }),
);

describe('useMarketPresetSwapOverridesEffect', () => {
  beforeEach(() => {
    mockMarketPresetToken = {
      networkId: 'evm--1',
      contractAddress: '0xmarket',
    };
    mockSetSwapStepNetFeeLevel.mockReset();
    mockSetSwapSlippageOverride.mockReset();
    mockEqualTokenNoCaseSensitive.mockReset();
    mockEqualTokenNoCaseSensitive.mockReturnValue(false);
  });

  it('clears preset overrides when preset token context is removed', () => {
    const { rerender } = renderHook(
      () =>
        useMarketPresetSwapOverridesEffect({
          marketPresetToken: mockMarketPresetToken,
        }),
      {},
    );

    mockSetSwapStepNetFeeLevel.mockClear();
    mockSetSwapSlippageOverride.mockClear();
    mockMarketPresetToken = undefined;
    rerender();

    expect(mockSetSwapStepNetFeeLevel).toHaveBeenCalledWith({
      networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
    });
    expect(mockSetSwapSlippageOverride).toHaveBeenCalledWith(undefined);
  });
});
