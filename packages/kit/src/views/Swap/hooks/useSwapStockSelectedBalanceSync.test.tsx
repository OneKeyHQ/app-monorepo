/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextSwap,
  swapStockSelectedFromTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';

import { useSwapStockSelectedBalanceSync } from './useSwapStockSelectedBalanceSync';

describe('useSwapStockSelectedBalanceSync', () => {
  it('does not loop when retained Stock and current token screens share a store', () => {
    const store = createStore();
    const Wrapper = ({ children }: { children?: ReactNode }) => (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );

    renderHook(
      () => {
        useSwapStockSelectedBalanceSync({
          balance: '5',
          enabled: true,
          ownerScope: 'stock-screen',
        });
        useSwapStockSelectedBalanceSync({
          balance: undefined,
          enabled: false,
          ownerScope: 'token-screen',
        });
      },
      { wrapper: Wrapper },
    );

    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
  });

  it('clears the previous owner balance before publishing the next live balance', () => {
    const store = createStore();
    store.set(swapStockSelectedFromTokenBalanceAtom(), '999');
    const Wrapper = ({ children }: { children?: ReactNode }) => (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
    const { rerender } = renderHook(
      ({
        balance,
        enabled,
        ownerScope,
      }: {
        balance?: string;
        enabled: boolean;
        ownerScope: string;
      }) =>
        useSwapStockSelectedBalanceSync({
          balance,
          enabled,
          ownerScope,
        }),
      {
        initialProps: {
          balance: undefined as string | undefined,
          enabled: true,
          ownerScope: 'account-b:token-b',
        },
        wrapper: Wrapper,
      },
    );

    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');

    act(() => {
      rerender({
        balance: '5',
        enabled: true,
        ownerScope: 'account-b:token-b',
      });
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('5');

    act(() => {
      rerender({
        balance: undefined,
        enabled: true,
        ownerScope: 'account-c:token-c',
      });
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
  });
});
