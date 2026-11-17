/* eslint-disable import/first */

// Effect-level cover for the wiring the pure resolver cannot reach: the
// per-session refs. Deleting either of them leaves borrowMarketMemory.utils
// fully green while the restore starts fighting the user's own pick.
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const state: {
    current: { marketKey: string };
    set: jest.Mock;
  } = {
    current: { marketKey: '' },
    set: jest.fn(),
  };
  (
    globalThis as unknown as { __borrowMarketMemoryAtomMock: typeof state }
  ).__borrowMarketMemoryAtomMock = state;

  return {
    useBorrowSelectedMarketAtom: () => [state.current, state.set],
  };
});

import { renderHook } from '@testing-library/react-native';

import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { useBorrowMarketMemory } from './useBorrowMarketMemory';

const atomMock = (
  globalThis as unknown as {
    __borrowMarketMemoryAtomMock: {
      current: { marketKey: string };
      set: jest.Mock;
    };
  }
).__borrowMarketMemoryAtomMock;

function buildMarket(marketAddress: string): IBorrowMarketItem {
  return {
    provider: 'Aave',
    networkId: 'evm--1',
    marketAddress,
  } as unknown as IBorrowMarketItem;
}

const first = buildMarket('0xAAA');
const remembered = buildMarket('0xBBB');
const rememberedKey = 'aave:evm--1:0xbbb';

type IHookProps = {
  market: IBorrowMarketItem | null;
  markets: IBorrowMarketItem[];
};

function renderMemory(setMarket: jest.Mock, initialProps: IHookProps) {
  return renderHook<ReturnType<typeof useBorrowMarketMemory>, IHookProps>(
    ({ market, markets }) =>
      useBorrowMarketMemory({ market, markets, setMarket }),
    { initialProps },
  );
}

describe('useBorrowMarketMemory', () => {
  beforeEach(() => {
    atomMock.current = { marketKey: '' };
    atomMock.set.mockReset();
  });

  it('restores the remembered market once the key hydrates', () => {
    const setMarket = jest.fn();
    const view = renderMemory(setMarket, {
      market: first,
      markets: [first, remembered],
    });
    expect(setMarket).not.toHaveBeenCalled();

    atomMock.current = { marketKey: rememberedKey };
    view.rerender({ market: first, markets: [first, remembered] });

    expect(setMarket).toHaveBeenCalledWith(remembered);
  });

  it('never restores after the user has picked a market', () => {
    const setMarket = jest.fn();
    const view = renderMemory(setMarket, {
      market: first,
      markets: [first, remembered],
    });

    view.result.current.rememberMarket(first);
    expect(atomMock.set).toHaveBeenCalledWith({
      marketKey: 'aave:evm--1:0xaaa',
    });

    // The persisted mirror echoes the previous value for a while after a write
    // on runtimes that proxy atom writes to the background; honouring it here
    // would drag the user back off the market they just chose.
    atomMock.current = { marketKey: rememberedKey };
    view.rerender({ market: first, markets: [first, remembered] });

    expect(setMarket).not.toHaveBeenCalled();
  });

  it('restores at most once, leaving later selections alone', () => {
    const setMarket = jest.fn();
    atomMock.current = { marketKey: rememberedKey };
    const view = renderMemory(setMarket, {
      market: first,
      markets: [first, remembered],
    });
    expect(setMarket).toHaveBeenCalledTimes(1);

    // A refresh that puts the selection back on the first market must not be
    // pulled onto the remembered one a second time.
    view.rerender({ market: first, markets: [first, remembered] });

    expect(setMarket).toHaveBeenCalledTimes(1);
  });
});
