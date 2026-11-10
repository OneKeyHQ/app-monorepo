/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type {
  IFill,
  IPerpsAssetPosition,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useShareTradeHistory } from './useShareTradeHistory';

const mockShowPositionShare = jest.fn();
let mockPositions: IPerpsAssetPosition[] = [];
let mockLastUsedLeverage: Record<string, number> = { ETH: 10 };

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetAtom: () => [{}],
  usePerpsLastUsedLeverageAtom: () => [mockLastUsedLeverage],
  useSpotPairDisplayMapAtom: () => [{}],
}));
jest.mock('./usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedActivePositions: () => mockPositions,
}));

beforeEach(() => {
  mockPositions = [];
  mockLastUsedLeverage = { ETH: 10 };
  mockShowPositionShare.mockClear();
});
jest.mock('./useShowPositionShare', () => ({
  useShowPositionShare: () => ({ showPositionShare: mockShowPositionShare }),
}));

it.each([
  {
    dir: 'Long > Short',
    side: 'A',
    px: '110',
    sz: '5',
    startPosition: '2',
    closedPnl: '20',
    expectedSide: 'long',
    pnl: '19',
    entryPrice: '106',
    pnlPercent: '35.85',
  },
  {
    dir: 'Short > Long',
    side: 'B',
    px: '90',
    sz: '5',
    startPosition: '-2',
    closedPnl: '20',
    expectedSide: 'short',
    pnl: '19',
    entryPrice: '94',
    pnlPercent: '40.43',
  },
  {
    dir: 'Close Long',
    side: 'A',
    px: '110',
    sz: '1',
    startPosition: '2',
    closedPnl: '10',
    expectedSide: 'long',
    pnl: '9',
    entryPrice: '100',
    pnlPercent: '90.00',
  },
  {
    dir: 'Close Short',
    side: 'B',
    px: '90',
    sz: '1',
    startPosition: '-2',
    closedPnl: '10',
    expectedSide: 'short',
    pnl: '9',
    entryPrice: '100',
    pnlPercent: '90.00',
  },
] as const)(
  'matches Hyperliquid trade sharing for $dir',
  async ({ expectedSide, pnl, entryPrice, pnlPercent, ...trade }) => {
    mockShowPositionShare.mockClear();
    const fill: IFill = {
      ...trade,
      coin: 'ETH',
      time: 1_800_000_000_000,
      hash: '0x1234',
      oid: 1,
      tid: 1,
      crossed: false,
      fee: '1',
      feeToken: 'USDC',
      twapId: null,
    };
    const { result } = renderHook(() => useShareTradeHistory());
    await act(async () => result.current(fill));
    expect(mockShowPositionShare).toHaveBeenCalledWith(
      expect.objectContaining({
        side: expectedSide,
        entryPrice,
        markPrice: trade.px,
        pnl,
        pnlPercent,
      }),
    );
  },
);

it.each([
  { positionCoin: 'ETH', leverage: 40, pnlPercent: '360.00' },
  { positionCoin: 'BTC', leverage: 17, pnlPercent: '153.00' },
])(
  'uses only the matching current position before cached leverage ($positionCoin)',
  async ({ positionCoin, leverage, pnlPercent }) => {
    mockLastUsedLeverage = { ETH: 17 };
    mockPositions = [
      {
        type: 'oneWay',
        position: {
          coin: positionCoin,
          leverage: { type: 'cross', value: 40 },
          szi: '1',
          entryPx: '100',
          positionValue: '110',
          unrealizedPnl: '10',
          returnOnEquity: '4',
          liquidationPx: null,
          marginUsed: '2.5',
          maxLeverage: 50,
          cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
        },
      },
    ];
    const fill: IFill = {
      coin: 'ETH',
      dir: 'Close Long',
      side: 'A',
      px: '110',
      sz: '1',
      startPosition: '2',
      closedPnl: '10',
      time: 1_800_000_000_000,
      hash: '0x1234',
      oid: 1,
      tid: 1,
      crossed: false,
      fee: '1',
      feeToken: 'USDC',
      twapId: null,
    };
    const { result } = renderHook(() => useShareTradeHistory());
    await act(async () => result.current(fill));
    expect(mockShowPositionShare).toHaveBeenCalledWith(
      expect.objectContaining({ leverage, pnlPercent, pnl: '9' }),
    );
  },
);
