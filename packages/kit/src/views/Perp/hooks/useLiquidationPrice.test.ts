/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';
import { BigNumber } from 'bignumber.js';

import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  EPerpsSizeInputMode,
  ETriggerOrderType,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { useLiquidationPrice } from './useLiquidationPrice';

interface IMockFormData {
  side: 'long' | 'short';
  type: 'market' | 'limit';
  price: string;
  orderMode: 'trigger' | 'standard' | 'scale' | 'twap';
  reduceOnly?: boolean;
  triggerOrderType?: ETriggerOrderType;
  triggerPrice?: string;
  executionPrice?: string;
  triggerReduceOnly?: boolean;
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
  accountAddress: string;
  coin: string;
  leverage: {
    value: number;
    type: string;
  };
  maxTradeSzs: [string, string];
}

interface IMockActiveAccount {
  accountAddress: string | null;
}

interface IMockPosition {
  position: {
    coin: string;
    szi: string;
    entryPx: string;
    leverage:
      | { type: 'cross'; value: number }
      | { type: 'isolated'; value: number; rawUsd: string };
  };
}

interface IMockOrderPrice {
  price: BigNumber;
}

let mockFormData: IMockFormData;
let mockActiveAsset: IMockActiveAsset;
let mockActiveAssetCtx: IMockActiveAssetCtx;
let mockActiveAssetData: IMockActiveAssetData;
let mockActiveAccount: IMockActiveAccount;
let mockPositionsAccountAddress: string | undefined;
let mockPositions: IMockPosition[];
let mockOrderPrice: IMockOrderPrice;
let mockCrossAvailable: BigNumber | undefined;

// Mock leaf modules directly — in the harness, Metro's `export *` creates
// non-configurable getter descriptors on barrel modules, so mutating the barrel
// fails silently. Mocking the leaf ensures the getter chain resolves to our mock.
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  useTradingFormAtom: () => [mockFormData],
  usePerpsActivePositionAtom: () => [
    {
      accountAddress: mockPositionsAccountAddress,
      activePositions: mockPositions,
    },
  ],
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: 'BTC' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/perps', () => ({
  usePerpsActiveAccountAtom: () => [mockActiveAccount],
  usePerpsActiveAssetAtom: () => [mockActiveAsset],
  usePerpsActiveAssetCtxAtom: () => [mockActiveAssetCtx],
  usePerpsActiveAssetDataAtom: () => [mockActiveAssetData],
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useTradingFormAtom: () => [mockFormData],
  usePerpsActivePositionAtom: () => [
    {
      accountAddress: mockPositionsAccountAddress,
      activePositions: mockPositions,
    },
  ],
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: 'BTC' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  getPerpsAccountDisplaySnapshotEntry: () => undefined,
  usePerpsActiveAccountAtom: () => [mockActiveAccount],
  usePerpsActiveAssetAtom: () => [mockActiveAsset],
  usePerpsActiveAssetCtxAtom: () => [mockActiveAssetCtx],
  usePerpsActiveAssetDataAtom: () => [mockActiveAssetData],
  usePerpsAccountDisplaySnapshotAtom: () => [{}],
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms',
  () => ({
    useActiveAccount: () => ({
      activeAccount: {
        ready: true,
        account: { id: 'account-id' },
        indexedAccount: { id: 'indexed-account-id' },
        deriveType: 'default',
      },
    }),
  }),
);

jest.mock('./useOrderPrice', () => ({
  useOrderPrice: () => mockOrderPrice,
}));

jest.mock('./usePerpsCrossAvailableAfterMaintenance', () => ({
  usePerpsCrossAvailableAfterMaintenance: () => mockCrossAvailable,
}));

const applyUnifiedScreenshotSetup = () => {
  mockFormData = {
    side: 'long',
    type: 'limit',
    price: '80000',
    orderMode: 'standard',
  };
  mockActiveAsset.margin.marginTiers = [{ lowerBound: '0', maxLeverage: 40 }];
  mockActiveAsset.universe.maxLeverage = 40;
  mockActiveAssetCtx.ctx.markPrice = '83312';
  mockActiveAssetData.leverage = { value: 27, type: 'cross' };
  mockOrderPrice = { price: new BigNumber(80_000) };
  mockCrossAvailable = new BigNumber('3.2555');
};

const resetMocks = () => {
  mockFormData = {
    side: 'long',
    type: 'limit',
    price: '',
    orderMode: 'trigger',
    triggerOrderType: ETriggerOrderType.TRIGGER_LIMIT,
    triggerPrice: '100',
    executionPrice: '110',
    triggerReduceOnly: false,
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
    accountAddress: '0xbbb',
    coin: 'BTC',
    leverage: {
      value: 10,
      type: 'isolated',
    },
    maxTradeSzs: ['20', '20'],
  };
  mockActiveAccount = {
    accountAddress: '0xbbb',
  };
  mockPositionsAccountAddress = '0xbbb';
  mockPositions = [];
  mockOrderPrice = {
    price: new BigNumber(110),
  };
  mockCrossAvailable = new BigNumber(50);
};

describe('useLiquidationPrice', () => {
  beforeEach(() => {
    resetMocks();
  });

  test('returns null for reduce-only trigger orders', () => {
    mockFormData.triggerReduceOnly = true;

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1) }),
    );

    expect(result.current).toBeNull();
  });

  test('returns null when trigger limit execution price is missing', () => {
    mockFormData.executionPrice = '';

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1) }),
    );

    expect(result.current).toBeNull();
  });

  test('returns null when trigger market trigger price is missing', () => {
    mockFormData.triggerOrderType = ETriggerOrderType.TRIGGER_MARKET;
    mockFormData.triggerPrice = '';

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1) }),
    );

    expect(result.current).toBeNull();
  });

  test('caps trigger preview size by current account snapshot', () => {
    mockFormData.executionPrice = '200';

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1000) }),
    );

    expect(result.current?.toNumber()).toBeCloseTo(189.473_684, 6);
  });

  test('returns null when current account snapshot cannot support any trigger size', () => {
    mockActiveAssetData.maxTradeSzs = ['0', '0'];

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1) }),
    );

    expect(result.current).toBeNull();
  });

  test('ignores cached positions from a different account', () => {
    mockPositionsAccountAddress = '0xaaa';
    mockPositions = [
      {
        position: {
          coin: 'BTC',
          szi: '10',
          entryPx: '50',
          leverage: { type: 'isolated', value: 10, rawUsd: '-450' },
        },
      },
    ];

    const { result: mismatchedAccountResult } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1) }),
    );

    mockPositionsAccountAddress = '0xbbb';
    mockPositions = [];

    const { result: emptyPositionResult } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1) }),
    );

    expect(mismatchedAccountResult.current?.toFixed()).toBe(
      emptyPositionResult.current?.toFixed(),
    );
  });

  test('estimates a unified cross limit order from the live collateral', () => {
    applyUnifiedScreenshotSetup();

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber('0.00012') }),
    );

    expect(result.current?.toNumber()).toBeCloseTo(53_540.084_388, 4);
  });

  test('hides the cross estimate until live collateral is available', () => {
    applyUnifiedScreenshotSetup();
    mockCrossAvailable = undefined;

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber('0.00012') }),
    );

    expect(result.current).toBeNull();
  });

  test('prices market orders at the mark price', () => {
    mockFormData = {
      side: 'long',
      type: 'market',
      price: '',
      orderMode: 'standard',
    };
    mockActiveAssetData.leverage = { value: 10, type: 'cross' };
    mockOrderPrice = { price: new BigNumber(90) };

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber(1) }),
    );

    expect(result.current?.toNumber()).toBeCloseTo(52.631_579, 6);
  });

  test('estimates with the size submitted for the requested side', () => {
    mockFormData = {
      side: 'long',
      type: 'market',
      price: '',
      orderMode: 'standard',
    };
    mockActiveAssetData.leverage = { value: 10, type: 'cross' };
    mockPositions = [
      {
        position: {
          coin: 'BTC',
          szi: '5',
          entryPx: '90',
          leverage: { type: 'cross', value: 10 },
        },
      },
    ];

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'short', size: new BigNumber('7.5') }),
    );

    expect(result.current?.toNumber()).toBeCloseTo(123.809_524, 6);
  });

  test('caps reduce-only standard orders at the existing position', () => {
    mockFormData = {
      side: 'short',
      type: 'market',
      price: '',
      orderMode: 'standard',
      reduceOnly: true,
    };
    mockActiveAssetData.leverage = { value: 10, type: 'cross' };
    mockPositions = [
      {
        position: {
          coin: 'BTC',
          szi: '1',
          entryPx: '90',
          leverage: { type: 'cross', value: 10 },
        },
      },
    ];

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'short', size: new BigNumber(2) }),
    );

    expect(result.current).toBeNull();
  });

  test('uses the popover ticket price instead of the form price', () => {
    applyUnifiedScreenshotSetup();
    mockOrderPrice = { price: new BigNumber(1) };
    const popoverTicket: ITradingFormData = {
      side: 'long',
      type: 'limit',
      price: '80000',
      size: '0.00012',
      sizeInputMode: EPerpsSizeInputMode.MANUAL,
      sizePercent: 0,
      hasTpsl: false,
      tpTriggerPx: '',
      tpGainPercent: '',
      slTriggerPx: '',
      slLossPercent: '',
      orderMode: 'standard',
    };

    const { result } = renderHook(() =>
      useLiquidationPrice({
        side: 'long',
        size: new BigNumber('0.00012'),
        formDataOverride: popoverTicket,
      }),
    );

    expect(result.current?.toNumber()).toBeCloseTo(53_540.084_388, 4);
  });

  test('ignores asset data loaded for another account', () => {
    applyUnifiedScreenshotSetup();
    mockActiveAssetData.accountAddress = '0xaaa';

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber('0.00012') }),
    );

    expect(result.current).toBeNull();
  });

  test('does not estimate scale orders', () => {
    applyUnifiedScreenshotSetup();
    mockFormData.orderMode = 'scale';

    const { result } = renderHook(() =>
      useLiquidationPrice({ side: 'long', size: new BigNumber('0.00012') }),
    );

    expect(result.current).toBeNull();
  });
});
