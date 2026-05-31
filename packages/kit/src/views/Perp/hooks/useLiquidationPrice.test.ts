/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';
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

interface IMockActiveAccount {
  accountAddress: string | null;
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
let mockActiveAccount: IMockActiveAccount;
let mockPositionsAccountAddress: string | undefined;
let mockPositions: IMockPosition[];
let mockOrderPrice: IMockOrderPrice;

// Mock leaf modules directly — in the harness, Metro's `export *` creates
// non-configurable getter descriptors on barrel modules, so mutating the barrel
// fails silently. Mocking the leaf ensures the getter chain resolves to our mock.
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  useTradingFormAtom: () => [mockFormData],
  useTradingFormComputedAtom: () => [mockTradingComputed],
  usePerpsActivePositionAtom: () => [
    {
      accountAddress: mockPositionsAccountAddress,
      activePositions: mockPositions,
    },
  ],
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: 'ETH' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/perps', () => ({
  usePerpsActiveAccountAtom: () => [mockActiveAccount],
  usePerpsActiveAccountSummaryAtom: () => [mockAccountSummary],
  usePerpsActiveAssetAtom: () => [mockActiveAsset],
  usePerpsActiveAssetCtxAtom: () => [mockActiveAssetCtx],
  usePerpsActiveAssetDataAtom: () => [mockActiveAssetData],
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useTradingFormAtom: () => [mockFormData],
  useTradingFormComputedAtom: () => [mockTradingComputed],
  usePerpsActivePositionAtom: () => [
    {
      accountAddress: mockPositionsAccountAddress,
      activePositions: mockPositions,
    },
  ],
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: 'ETH' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  getPerpsAccountDisplaySnapshotEntry: () => undefined,
  usePerpsActiveAccountAtom: () => [mockActiveAccount],
  usePerpsActiveAccountSummaryAtom: () => [mockAccountSummary],
  usePerpsActiveAssetAtom: () => [mockActiveAsset],
  usePerpsActiveAssetCtxAtom: () => [mockActiveAssetCtx],
  usePerpsActiveAssetDataAtom: () => [mockActiveAssetData],
  usePerpsAccountDisplaySnapshotAtom: () => [{}],
  usePerpsComputedAccountValueAtom: () => [
    { accountValue: '10000', isLoading: false },
  ],
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
  mockActiveAccount = {
    accountAddress: '0xbbb',
  };
  mockPositionsAccountAddress = '0xbbb';
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

  test('ignores cached positions from a different account', () => {
    mockPositionsAccountAddress = '0xaaa';
    mockPositions = [
      {
        position: {
          coin: 'BTC',
          szi: '10',
          entryPx: '50',
        },
      },
    ];

    const { result: mismatchedAccountResult } = renderHook(() =>
      useLiquidationPrice('long'),
    );

    mockPositionsAccountAddress = '0xbbb';
    mockPositions = [];

    const { result: emptyPositionResult } = renderHook(() =>
      useLiquidationPrice('long'),
    );

    expect(mismatchedAccountResult.current?.toFixed()).toBe(
      emptyPositionResult.current?.toFixed(),
    );
  });
});
