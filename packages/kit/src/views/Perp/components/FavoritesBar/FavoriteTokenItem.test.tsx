/** @jest-environment jsdom */

import { createContext } from 'react';
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';
import { atom, getDefaultStore } from 'jotai';

import { FavoriteTokenItem } from './FavoriteTokenItem';

const mockQuoteRender = jest.fn();
type ITestActiveCtx =
  | { coin: string; ctx: { markPrice: string; change24hPercent: number } }
  | undefined;
const mockPerpActiveCtxAtom = atom<ITestActiveCtx>(undefined);
const mockSpotActiveCtxAtom = atom<ITestActiveCtx>(undefined);

const mockMarketContext = createContext<{
  coin: string;
  marketPrice?: string;
  activeCtx?: {
    coin: string;
    ctx: { markPrice: string; change24hPercent: number };
  };
}>({ coin: '@1' });
const mockPerpContext = createContext<{
  activeCoin?: string;
  marketPrice?: string;
  activeCtx?: {
    coin: string;
    ctx: { markPrice: string; change24hPercent: number };
  };
}>({});
const mockSpotPrices = {
  '@1': { markPx: '128.97', prevDayPx: '100' },
  '@2': { markPx: '120.02', prevDayPx: '100' },
};

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SizableText: ({ children }: { children?: ReactNode }) => {
    mockQuoteRender();
    return <span>{children}</span>;
  },
  NumberSizeableText: ({
    children,
    color,
  }: {
    children?: ReactNode;
    color?: string;
  }) => (
    <span data-testid="change" data-color={color}>
      {children}
    </span>
  ),
  Skeleton: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    return [{ mode: 'spot', coin: useContext(mockMarketContext).coin }];
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  usePerpsCtxByCoin: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    return {
      markPx: useContext(mockPerpContext).marketPrice ?? '3120',
      prevDayPx: '3000',
    };
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsActiveAssetCtxAtom: { atom: () => mockPerpActiveCtxAtom },
  spotActiveAssetCtxAtom: { atom: () => mockSpotActiveCtxAtom },
  usePerpsActiveAssetAtom: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    const { activeCoin } = useContext(mockPerpContext);
    return [activeCoin ? { coin: activeCoin } : undefined];
  },
  useSpotAssetCtxsMapAtom: () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    const { marketPrice } = useContext(mockMarketContext);
    return [
      {
        ...mockSpotPrices,
        '@2': { markPx: marketPrice ?? '120.02', prevDayPx: '100' },
      },
    ];
  },
}));

type IQuoteState = {
  selected: boolean;
  marketPrice: string;
  activePrice?: string;
  wrongCoin?: boolean;
  change?: number;
};

function createQuoteContexts(state: IQuoteState, coin: string) {
  const activeCtx = state.activePrice
    ? {
        coin: state.wrongCoin ? 'OTHER' : coin,
        ctx: {
          markPrice: state.activePrice,
          change24hPercent: state.change ?? -8,
        },
      }
    : undefined;
  const perp = {
    activeCoin: state.selected ? coin : 'OTHER',
    marketPrice: state.marketPrice,
    activeCtx,
  };
  const spot = {
    coin: state.selected ? coin : 'OTHER',
    marketPrice: state.marketPrice,
    activeCtx,
  };
  return { perp, spot };
}

function renderFavorite(mode: 'perp' | 'spot', initial: IQuoteState) {
  let coin = mode === 'perp' ? 'kBONK' : '@2';
  const view = (state: IQuoteState, percent = false) => {
    const { perp, spot } = createQuoteContexts(state, coin);
    getDefaultStore().set(mockPerpActiveCtxAtom, perp.activeCtx);
    getDefaultStore().set(mockSpotActiveCtxAtom, spot.activeCtx);
    return (
      <mockPerpContext.Provider value={perp}>
        <mockMarketContext.Provider value={spot}>
          <FavoriteTokenItem
            displayName={coin}
            coinName={coin}
            imageTokenName={coin}
            assetId={1}
            dexIndex={0}
            mode={mode}
            displayMode={percent ? 'percent' : 'price'}
            onPress={jest.fn()}
          />
        </mockMarketContext.Provider>
      </mockPerpContext.Provider>
    );
  };
  const result = render(view(initial));
  return {
    ...result,
    update: (state: IQuoteState, percent = false) =>
      act(() => result.rerender(view(state, percent))),
    replaceCoin: (state: IQuoteState) => {
      coin = mode === 'perp' ? 'ETH' : '@1';
      act(() => result.rerender(view(state)));
    },
  };
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const marketState: IQuoteState = {
  selected: false,
  marketPrice: '0.00346',
  activePrice: '0.003459',
};
const selectedState = { ...marketState, selected: true };

describe.each(['perp', 'spot'] as const)(
  '%s favorite source transitions',
  (mode) => {
    it('holds the quote during rapid switches, then follows active ticks without ongoing delay', () => {
      const { getByText, update } = renderFavorite(mode, marketState);
      for (const selected of [true, false, true, false, true]) {
        update({ ...marketState, selected });
        advance(40);
        expect(getByText('0.00346')).toBeTruthy();
      }
      advance(250);
      expect(getByText('0.003459')).toBeTruthy();
      update({ ...selectedState, activePrice: '0.003458' });
      expect(getByText('0.003458')).toBeTruthy();
    });

    it('uses the latest pending quote without restarting the window on each tick', () => {
      const { getByText, update } = renderFavorite(mode, marketState);
      update(selectedState);
      for (const activePrice of [
        '0.003457',
        '0.003458',
        '0.003459',
        '0.003461',
      ]) {
        advance(50);
        update({ ...selectedState, activePrice });
        expect(getByText('0.00346')).toBeTruthy();
      }
      advance(50);
      expect(getByText('0.003461')).toBeTruthy();
    });

    it('keeps the last active quote while leaving, then resumes market ticks', () => {
      const { getByText, update } = renderFavorite(mode, selectedState);
      expect(getByText('0.003459')).toBeTruthy();
      update(marketState);
      expect(getByText('0.003459')).toBeTruthy();
      update({ ...marketState, marketPrice: '0.003461' });
      advance(250);
      expect(getByText('0.003461')).toBeTruthy();
      update({ ...marketState, marketPrice: '0.003462' });
      expect(getByText('0.003462')).toBeTruthy();
    });

    it('rejects a wrong coin and transitions when matching active data eventually arrives', () => {
      const { getByText, update } = renderFavorite(mode, {
        ...selectedState,
        wrongCoin: true,
      });
      advance(1000);
      expect(getByText('0.00346')).toBeTruthy();
      update({ ...selectedState, activePrice: undefined });
      expect(getByText('0.00346')).toBeTruthy();
      update(selectedState);
      expect(getByText('0.00346')).toBeTruthy();
      advance(250);
      expect(getByText('0.003459')).toBeTruthy();
    });

    it('cancels an obsolete handoff when switching back before it completes', () => {
      const { getByText, update } = renderFavorite(mode, selectedState);
      update(marketState);
      advance(100);
      update({ ...selectedState, activePrice: '0.003461' });
      expect(getByText('0.003461')).toBeTruthy();
      expect(jest.getTimerCount()).toBe(0);
      // Cross the obsolete timer's deadline, then deliver another live tick.
      advance(150);
      update({ ...selectedState, activePrice: '0.003462' });
      expect(getByText('0.003462')).toBeTruthy();
    });

    it('holds price and percentage together and uses the latest percentage at handoff', () => {
      const { getByTestId, update } = renderFavorite(mode, marketState);
      update({ ...selectedState, change: -8 }, true);
      expect(Number(getByTestId('change').textContent)).not.toBe(-8);
      advance(150);
      update({ ...selectedState, change: 12 }, true);
      advance(100);
      expect(Number(getByTestId('change').textContent)).toBe(12);
      expect(getByTestId('change').getAttribute('data-color')).toBe(
        '$textSuccess',
      );
      update({ ...selectedState, change: -3 }, true);
      expect(Number(getByTestId('change').textContent)).toBe(-3);
      expect(getByTestId('change').getAttribute('data-color')).toBe(
        '$textCritical',
      );
    });

    it('does not retain the old coin snapshot if the item identity changes', () => {
      const { getByText, update, replaceCoin } = renderFavorite(
        mode,
        marketState,
      );
      update(selectedState);
      advance(100);
      replaceCoin({ ...selectedState, activePrice: '3150' });
      expect(getByText('3150')).toBeTruthy();
      advance(500);
      expect(getByText('3150')).toBeTruthy();
    });

    it('does not rerender an inactive favorite on either active quote stream', () => {
      const { getByText } = renderFavorite(mode, marketState);
      mockQuoteRender.mockClear();
      for (const activeAtom of [mockPerpActiveCtxAtom, mockSpotActiveCtxAtom]) {
        act(() =>
          getDefaultStore().set(activeAtom, {
            coin: 'OTHER',
            ctx: { markPrice: '65000', change24hPercent: 3 },
          }),
        );
      }
      expect(getByText('0.00346')).toBeTruthy();
      expect(mockQuoteRender).not.toHaveBeenCalled();
    });

    it('cleans up a pending handoff on unmount', () => {
      const { update, unmount } = renderFavorite(mode, marketState);
      const timersBefore = jest.getTimerCount();
      update(selectedState);
      expect(jest.getTimerCount()).toBeGreaterThan(timersBefore);
      unmount();
      expect(jest.getTimerCount()).toBe(timersBefore);
    });
  },
);
