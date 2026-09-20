import { act, renderHook } from '@testing-library/react-native';
import { cloneDeep } from 'lodash';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { jotaiDefaultStore } from '../utils/jotaiDefaultStore';

import {
  inAppNotificationAtom,
  useInAppNotificationAtom,
  useInAppNotificationSwapApproving,
  useInAppNotificationSwapRecentTokenPairs,
  useSetInAppNotificationAtom,
} from './InAppNotification';

import type { IInAppNotificationAtom } from './InAppNotification';

const token = (symbol: string) => ({ symbol }) as unknown as ISwapToken;

// What a push from the background runtime looks like on the main runtime:
// the same content, every identity new.
const pushFromBackground = (
  change: (state: IInAppNotificationAtom) => IInAppNotificationAtom,
) => {
  act(() => {
    jotaiDefaultStore.set(inAppNotificationAtom.atom(), (state) =>
      cloneDeep(change(state)),
    );
  });
};

const countRenders = <T,>(useValue: () => T) => {
  let renders = 0;
  const hook = renderHook(() => {
    renders += 1;
    return useValue();
  });
  return { ...hook, getRenders: () => renders };
};

describe('inAppNotificationAtom slice hooks', () => {
  beforeEach(() => {
    pushFromBackground((state) => ({
      ...state,
      swapRecentTokenPairs: [
        { fromToken: token('ETH'), toToken: token('USDC') },
      ],
      swapLimitOrdersLoading: false,
      swapApprovingLoading: false,
      swapApprovingTransaction: undefined,
    }));
  });

  it('re-renders a whole-atom reader on a write to a field it never reads', () => {
    const { getRenders, unmount } = countRenders(
      () => useInAppNotificationAtom()[0].swapRecentTokenPairs,
    );
    const before = getRenders();

    pushFromBackground((state) => ({ ...state, swapLimitOrdersLoading: true }));

    expect(getRenders()).toBeGreaterThan(before);
    unmount();
  });

  it('leaves a slice reader alone when another field is written', () => {
    const { result, getRenders, unmount } = countRenders(
      useInAppNotificationSwapRecentTokenPairs,
    );
    const before = getRenders();
    const pairsBefore = result.current;

    pushFromBackground((state) => ({ ...state, swapLimitOrdersLoading: true }));
    pushFromBackground((state) => ({
      ...state,
      swapLimitOrdersLoading: false,
    }));
    pushFromBackground((state) => ({ ...state }));

    expect(getRenders()).toBe(before);
    expect(result.current).toBe(pairsBefore);
    unmount();
  });

  it('re-renders a slice reader once its own slice changes', () => {
    const { result, getRenders, unmount } = countRenders(
      useInAppNotificationSwapRecentTokenPairs,
    );
    const before = getRenders();

    pushFromBackground((state) => ({
      ...state,
      swapRecentTokenPairs: [
        { fromToken: token('BTC'), toToken: token('ETH') },
        ...state.swapRecentTokenPairs,
      ],
    }));

    expect(getRenders()).toBe(before + 1);
    expect(result.current.map((pair) => pair.fromToken.symbol)).toEqual([
      'BTC',
      'ETH',
    ]);
    unmount();
  });

  it('compares an object slice by value', () => {
    const { result, getRenders, unmount } = countRenders(
      useInAppNotificationSwapApproving,
    );
    const before = getRenders();

    pushFromBackground((state) => ({ ...state, swapLimitOrdersLoading: true }));
    expect(getRenders()).toBe(before);

    pushFromBackground((state) => ({ ...state, swapApprovingLoading: true }));
    expect(getRenders()).toBe(before + 1);
    expect(result.current.swapApprovingLoading).toBe(true);
    unmount();
  });

  it('never re-renders a component that only writes', () => {
    const { result, getRenders, unmount } = countRenders(
      useSetInAppNotificationAtom,
    );
    const before = getRenders();

    pushFromBackground((state) => ({ ...state, swapLimitOrdersLoading: true }));
    act(() => {
      void result.current((state) => ({
        ...state,
        swapApprovingLoading: true,
      }));
    });

    expect(getRenders()).toBe(before);
    expect(
      jotaiDefaultStore.get(inAppNotificationAtom.atom()).swapApprovingLoading,
    ).toBe(true);
    unmount();
  });
});
