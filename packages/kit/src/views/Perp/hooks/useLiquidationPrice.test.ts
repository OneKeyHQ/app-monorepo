/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { BigNumber } from 'bignumber.js';

import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useLiquidationPrice } from './useLiquidationPrice';

interface IMockFormData {
  side: 'long' | 'short';
  orderMode: 'trigger' | 'standard';
  triggerOrderType?: ETriggerOrderType;
  triggerPrice?: string;
  executionPrice?: string;
  triggerReduceOnly?: boolean;
}

interface IMockTradingComputed {
  computedSizeBN: BigNumber;
}

interface IMockActiveAsset {
  coin: string;
  margin: {
    marginTiers: Array<{ lowerBound: string; maxLeverage: number }>;
  };
  universe: {
    maxLeverage: number;
    szDecimals: number;
  };
}

interface IMockActiveAssetCtx {
  ctx: {
    markPrice: string;
  };
}

interface IMockActiveAssetData {
  leverage: {
    value: number;
    type: string;
  };
  maxTradeSzs: [string, string];
}

interface IMockAccountSummary {
  crossAccountValue: string;
  crossMaintenanceMarginUsed: string;
}

interface IMockPosition {
  position: {
    coin: string;
    szi: string;
    entryPx: string;
  };
}

interface IMockOrderPrice {
  price: BigNumber;
}

let mockFormData: IMockFormData;
let mockTradingComputed: IMockTradingComputed;
let mockActiveAsset: IMockActiveAsset;
let mockActiveAssetCtx: IMockActiveAssetCtx;
let mockActiveAssetData: IMockActiveAssetData;
let mockAccountSummary: IMockAccountSummary;
let mockPositions: IMockPosition[];
let mockOrderPrice: IMockOrderPrice;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useTradingFormAtom: () => [mockFormData],
  useTradingFormComputedAtom: () => [mockTradingComputed],
  usePerpsActivePositionAtom: () => [{ activePositions: mockPositions }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountSummaryAtom: () => [mockAccountSummary],
  usePerpsActiveAssetAtom: () => [mockActiveAsset],
  usePerpsActiveAssetCtxAtom: () => [mockActiveAssetCtx],
  usePerpsActiveAssetDataAtom: () => [mockActiveAssetData],
}));

jest.mock('./useOrderPrice', () => ({
  useOrderPrice: () => mockOrderPrice,
}));

const resetMocks = () => {
  mockFormData = {
    side: 'long',
    orderMode: 'trigger',
    triggerOrderType: ETriggerOrderType.TRIGGER_LIMIT,
    triggerPrice: '100',
    executionPrice: '110',
    triggerReduceOnly: false,
  };
  mockTradingComputed = {
    computedSizeBN: new BigNumber(1),
  };
  mockActiveAsset = {
    coin: 'BTC',
    margin: {
      marginTiers: [{ lowerBound: '0', maxLeverage: 10 }],
    },
    universe: {
      maxLeverage: 10,
      szDecimals: 2,
    },
  };
  mockActiveAssetCtx = {
    ctx: {
      markPrice: '100',
    },
  };
  mockActiveAssetData = {
    leverage: {
      value: 10,
      type: 'isolated',
    },
    maxTradeSzs: ['20', '20'],
  };
  mockAccountSummary = {
    crossAccountValue: '100',
    crossMaintenanceMarginUsed: '20',
  };
  mockPositions = [];
  mockOrderPrice = {
    price: new BigNumber(110),
  };
};

describe('useLiquidationPrice', () => {
  beforeEach(() => {
    resetMocks();
  });

  test('returns null for reduce-only trigger orders', () => {
    mockFormData.triggerReduceOnly = true;

    const { result } = renderHook(() => useLiquidationPrice('long'));

    expect(result.current).toBeNull();
  });

  test('returns null when trigger limit execution price is missing', () => {
    mockFormData.executionPrice = '';

    const { result } = renderHook(() => useLiquidationPrice('long'));

    expect(result.current).toBeNull();
  });

  test('returns null when trigger market trigger price is missing', () => {
    mockFormData.triggerOrderType = ETriggerOrderType.TRIGGER_MARKET;
    mockFormData.triggerPrice = '';

    const { result } = renderHook(() => useLiquidationPrice('long'));

    expect(result.current).toBeNull();
  });

  test('caps trigger preview size by current account snapshot', () => {
    mockFormData.executionPrice = '200';
    mockTradingComputed.computedSizeBN = new BigNumber(1000);

    const { result } = renderHook(() => useLiquidationPrice('long'));

    expect(result.current?.toNumber()).toBeCloseTo(189.473_684, 6);
  });

  test('returns null when current account snapshot cannot support any trigger size', () => {
    mockActiveAssetData.maxTradeSzs = ['0', '0'];

    const { result } = renderHook(() => useLiquidationPrice('long'));

    expect(result.current).toBeNull();
  });
});
