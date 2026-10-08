/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { usePerpsCrossAvailableAfterMaintenance } from './usePerpsCrossAvailableAfterMaintenance';

interface IMockRiskInputs {
  accountAddress: string;
  abstractionMode?: EHyperLiquidAbstractionMode;
  tokenToAvailableAfterMaintenance?: Record<number, string>;
  crossMarginByDex?: Record<
    string,
    { accountValue: string; maintenanceMarginUsed: string }
  >;
}

let mockActiveAccount: { accountAddress: string | null };
let mockAbstractionMode:
  | { accountAddress: string; mode: EHyperLiquidAbstractionMode }
  | undefined;
let mockRiskInputs: IMockRiskInputs | undefined;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/perps', () => ({
  usePerpsActiveAccountAtom: () => [mockActiveAccount],
  usePerpsAbstractionModeAtom: () => [mockAbstractionMode],
  usePerpsLiquidationRiskInputsAtom: () => [mockRiskInputs],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [mockActiveAccount],
  usePerpsAbstractionModeAtom: () => [mockAbstractionMode],
  usePerpsLiquidationRiskInputsAtom: () => [mockRiskInputs],
}));

describe('usePerpsCrossAvailableAfterMaintenance', () => {
  beforeEach(() => {
    mockActiveAccount = { accountAddress: '0xBBB' };
    mockAbstractionMode = {
      accountAddress: '0xbbb',
      mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
    };
    mockRiskInputs = {
      accountAddress: '0xbbb',
      abstractionMode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      tokenToAvailableAfterMaintenance: { 0: '3.2555' },
      crossMarginByDex: {
        '': { accountValue: '100', maintenanceMarginUsed: '20' },
        'xyz': { accountValue: '900', maintenanceMarginUsed: '5' },
      },
    };
  });

  test('returns the unified USDC availability of the active account', () => {
    const { result } = renderHook(() =>
      usePerpsCrossAvailableAfterMaintenance('BTC'),
    );

    expect(result.current?.toFixed()).toBe('3.2555');
  });

  test('ignores risk inputs received for another account', () => {
    mockRiskInputs = { ...mockRiskInputs, accountAddress: '0xaaa' };

    const { result } = renderHook(() =>
      usePerpsCrossAvailableAfterMaintenance('BTC'),
    );

    expect(result.current).toBeUndefined();
  });

  test('hides an old-mode snapshot while cross-runtime mode and risk updates arrive separately', () => {
    const { result, rerender } = renderHook(() =>
      usePerpsCrossAvailableAfterMaintenance('BTC'),
    );
    expect(result.current?.toFixed()).toBe('3.2555');
    mockAbstractionMode = {
      accountAddress: '0xbbb',
      mode: EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
    };
    rerender({});
    expect(result.current).toBeUndefined();
    mockRiskInputs = {
      accountAddress: '0xbbb',
      abstractionMode: EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
      tokenToAvailableAfterMaintenance: { 0: '20' },
    };
    rerender({});
    expect(result.current?.toFixed()).toBe('20');
  });
});
