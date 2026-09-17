/** @jest-environment jsdom */

import type { Context, ReactNode } from 'react';

import { act, render, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextSwap,
  swapStockSelectedFromTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';

import { useSwapStockSelectedBalanceSync } from './useSwapStockSelectedBalanceSync';

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const ReactModule = require('react') as typeof import('react');
  const FocusContext = ReactModule.createContext(true);
  return {
    FocusContext,
    useRouteIsFocused: () => ReactModule.useContext(FocusContext),
  };
});

const { FocusContext } = jest.requireMock(
  '@onekeyhq/kit/src/hooks/useRouteIsFocused',
) as {
  FocusContext: Context<boolean>;
};

function SyncRunner({
  balance,
  enabled,
  ownerScope,
}: {
  balance?: string;
  enabled: boolean;
  ownerScope: string;
}) {
  useSwapStockSelectedBalanceSync({
    balance,
    enabled,
    ownerScope,
  });
  return null;
}

function SyncUnderFocus({
  isFocused,
  ...props
}: {
  isFocused: boolean;
  balance?: string;
  enabled: boolean;
  ownerScope: string;
}) {
  return (
    <FocusContext.Provider value={isFocused}>
      <SyncRunner {...props} />
    </FocusContext.Provider>
  );
}

function createSwapWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
  };
}

function DualFocusedSync({
  left,
  right,
}: {
  left: {
    isFocused: boolean;
    balance?: string;
    enabled: boolean;
    ownerScope: string;
  };
  right: {
    isFocused: boolean;
    balance?: string;
    enabled: boolean;
    ownerScope: string;
  };
}) {
  return (
    <>
      <SyncUnderFocus {...left} />
      <SyncUnderFocus {...right} />
    </>
  );
}

describe('useSwapStockSelectedBalanceSync', () => {
  it('does not loop when retained Stock and current token screens share a store', () => {
    const store = createStore();
    const Wrapper = createSwapWrapper(store);

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

  it('does not let an unfocused retained stock screen overwrite the current balance', () => {
    const store = createStore();
    const Wrapper = createSwapWrapper(store);
    const { rerender } = render(
      <Wrapper>
        <DualFocusedSync
          left={{
            isFocused: true,
            balance: '5',
            enabled: true,
            ownerScope: 'stock-a',
          }}
          right={{
            isFocused: false,
            balance: undefined,
            enabled: false,
            ownerScope: 'token-screen',
          }}
        />
      </Wrapper>,
    );

    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('5');

    act(() => {
      rerender(
        <Wrapper>
          <DualFocusedSync
            left={{
              isFocused: false,
              balance: '5',
              enabled: true,
              ownerScope: 'stock-a',
            }}
            right={{
              isFocused: true,
              balance: undefined,
              enabled: false,
              ownerScope: 'token-screen',
            }}
          />
        </Wrapper>,
      );
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');

    act(() => {
      rerender(
        <Wrapper>
          <DualFocusedSync
            left={{
              isFocused: false,
              balance: '9',
              enabled: true,
              ownerScope: 'stock-a',
            }}
            right={{
              isFocused: true,
              balance: undefined,
              enabled: false,
              ownerScope: 'token-screen',
            }}
          />
        </Wrapper>,
      );
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');
  });

  it('republishes the retained stock balance when that screen is focused again', () => {
    const store = createStore();
    const Wrapper = createSwapWrapper(store);
    const { rerender } = render(
      <Wrapper>
        <DualFocusedSync
          left={{
            isFocused: true,
            balance: '5',
            enabled: true,
            ownerScope: 'stock-screen',
          }}
          right={{
            isFocused: false,
            balance: undefined,
            enabled: false,
            ownerScope: 'token-screen',
          }}
        />
      </Wrapper>,
    );

    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('5');

    act(() => {
      rerender(
        <Wrapper>
          <DualFocusedSync
            left={{
              isFocused: false,
              balance: '5',
              enabled: true,
              ownerScope: 'stock-screen',
            }}
            right={{
              isFocused: true,
              balance: undefined,
              enabled: false,
              ownerScope: 'token-screen',
            }}
          />
        </Wrapper>,
      );
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('');

    act(() => {
      rerender(
        <Wrapper>
          <DualFocusedSync
            left={{
              isFocused: true,
              balance: '5',
              enabled: true,
              ownerScope: 'stock-screen',
            }}
            right={{
              isFocused: false,
              balance: undefined,
              enabled: false,
              ownerScope: 'token-screen',
            }}
          />
        </Wrapper>,
      );
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('5');
  });

  it('does not let an unfocused stock screen overwrite another focused stock balance', () => {
    const store = createStore();
    const Wrapper = createSwapWrapper(store);
    const { rerender } = render(
      <Wrapper>
        <DualFocusedSync
          left={{
            isFocused: true,
            balance: '5',
            enabled: true,
            ownerScope: 'stock-a',
          }}
          right={{
            isFocused: false,
            balance: undefined,
            enabled: true,
            ownerScope: 'stock-b',
          }}
        />
      </Wrapper>,
    );

    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('5');

    act(() => {
      rerender(
        <Wrapper>
          <DualFocusedSync
            left={{
              isFocused: false,
              balance: '5',
              enabled: true,
              ownerScope: 'stock-a',
            }}
            right={{
              isFocused: true,
              balance: '10',
              enabled: true,
              ownerScope: 'stock-b',
            }}
          />
        </Wrapper>,
      );
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('10');

    act(() => {
      rerender(
        <Wrapper>
          <DualFocusedSync
            left={{
              isFocused: false,
              balance: '8',
              enabled: true,
              ownerScope: 'stock-a',
            }}
            right={{
              isFocused: true,
              balance: '10',
              enabled: true,
              ownerScope: 'stock-b',
            }}
          />
        </Wrapper>,
      );
    });
    expect(store.get(swapStockSelectedFromTokenBalanceAtom())).toBe('10');
  });

  it('clears the previous owner balance before publishing the next live balance', () => {
    const store = createStore();
    store.set(swapStockSelectedFromTokenBalanceAtom(), '999');
    const Wrapper = createSwapWrapper(store);
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
