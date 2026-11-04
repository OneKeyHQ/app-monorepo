/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useShareTradeHistory } from './useShareTradeHistory';

const mockShowPositionShare = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetAtom: () => [{}],
  usePerpsLastUsedLeverageAtom: () => [{ ETH: 10 }],
  useSpotPairDisplayMapAtom: () => [{}],
}));
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
