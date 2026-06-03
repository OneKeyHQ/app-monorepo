/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

import { usePerpsActivePositionsByAddress } from './usePerpsActivePositionsByAddress';

type IMockPosition = {
  position: {
    coin: string;
  };
};

let mockPositionsAccountAddress: string | undefined;
let mockPositions: IMockPosition[];

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  usePerpsActivePositionAtom: () => [
    {
      accountAddress: mockPositionsAccountAddress,
      activePositions: mockPositions,
    },
  ],
}));

const resetMocks = () => {
  mockPositionsAccountAddress = '0xABC';
  mockPositions = [
    {
      position: {
        coin: 'BTC',
      },
    },
  ];
};

describe('usePerpsActivePositionsByAddress', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns positions for the explicit active account without reading account selector context', () => {
    const { result } = renderHook(() =>
      usePerpsActivePositionsByAddress('0xabc'),
    );

    expect(result.current).toBe(mockPositions);
  });

  it('drops positions from a different account', () => {
    const { result } = renderHook(() =>
      usePerpsActivePositionsByAddress('0xdef'),
    );

    expect(result.current).toEqual([]);
  });
});
