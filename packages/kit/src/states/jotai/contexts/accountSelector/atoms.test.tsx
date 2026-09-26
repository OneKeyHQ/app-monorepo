/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorJotaiProvider,
  accountSelectorActiveAccountInitDoneAtom,
  accountSelectorAvailableNetworksAtom,
  accountSelectorSyncLoadingAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
  useAccountSelectorAvailableNetworksByNum,
  useAccountSelectorUpdateMetaByNum,
  useActiveAccount,
  useIsAccountSelectorActiveAccountInitDone,
  useIsAccountSelectorSyncLoading,
  useSelectedAccount,
} from './atoms';

describe('account selector atom hooks', () => {
  it('does not rerender a slot when another slot changes', () => {
    const store = createStore();
    store.set(selectedAccountsAtom(), {
      0: defaultSelectedAccount(),
      1: defaultSelectedAccount(),
    });
    store.set(activeAccountsAtom(), {
      0: defaultActiveAccountInfo(),
      1: defaultActiveAccountInfo(),
    });
    store.set(accountSelectorActiveAccountInitDoneAtom(), {
      0: false,
      1: false,
    });
    store.set(accountSelectorAvailableNetworksAtom(), {
      0: {},
      1: {},
    });
    store.set(accountSelectorSyncLoadingAtom(), {
      0: { isLoading: false },
      1: { isLoading: false },
    });
    store.set(accountSelectorUpdateMetaAtom(), {});

    function Wrapper({ children }: { children?: ReactNode }) {
      return (
        <AccountSelectorJotaiProvider
          store={store}
          config={{ sceneName: EAccountSelectorSceneName.home }}
        >
          {children}
        </AccountSelectorJotaiProvider>
      );
    }

    let renderCount = 0;
    renderHook(
      () => {
        renderCount += 1;
        useSelectedAccount({ num: 0 });
        useActiveAccount({ num: 0 });
        useIsAccountSelectorActiveAccountInitDone(0);
        useAccountSelectorAvailableNetworksByNum(0);
        useIsAccountSelectorSyncLoading(0);
        useAccountSelectorUpdateMetaByNum(0);
      },
      { wrapper: Wrapper },
    );

    const initialRenderCount = renderCount;
    expect(initialRenderCount).toBeGreaterThan(0);

    act(() => {
      store.set(selectedAccountsAtom(), (current) => ({
        ...current,
        1: {
          ...(current[1] || defaultSelectedAccount()),
          networkId: 'evm--1',
        },
      }));
      store.set(activeAccountsAtom(), (current) => ({
        ...current,
        1: {
          ...defaultActiveAccountInfo(),
          ready: true,
        },
      }));
      store.set(accountSelectorActiveAccountInitDoneAtom(), (current) => ({
        ...current,
        1: true,
      }));
      store.set(accountSelectorAvailableNetworksAtom(), (current) => ({
        ...current,
        1: { networkIds: ['evm--1'] },
      }));
      store.set(accountSelectorSyncLoadingAtom(), (current) => ({
        ...current,
        1: { isLoading: true },
      }));
      store.set(accountSelectorUpdateMetaAtom(), (current) => ({
        ...current,
        1: {
          eventEmitDisabled: false,
          updatedAt: Date.now(),
        },
      }));
    });

    expect(renderCount).toBe(initialRenderCount);

    act(() => {
      store.set(selectedAccountsAtom(), (current) => ({
        ...current,
        0: {
          ...(current[0] || defaultSelectedAccount()),
          networkId: 'evm--1',
        },
      }));
    });

    expect(renderCount).toBeGreaterThan(initialRenderCount);
  });

  it('keeps update cost isolated with many enabled nums', () => {
    const slotCount = 64;
    const targetNum = 37;
    const store = createStore();
    store.set(
      selectedAccountsAtom(),
      Object.fromEntries(
        Array.from({ length: slotCount }, (_value, num) => [
          num,
          defaultSelectedAccount(),
        ]),
      ),
    );

    function Wrapper({ children }: { children?: ReactNode }) {
      return (
        <AccountSelectorJotaiProvider
          store={store}
          config={{ sceneName: EAccountSelectorSceneName.home }}
        >
          {children}
        </AccountSelectorJotaiProvider>
      );
    }

    const renderCounts = Array.from({ length: slotCount }, () => 0);
    function Slot({ num }: { num: number }) {
      renderCounts[num] += 1;
      useSelectedAccount({ num });
      return null;
    }

    render(
      <Wrapper>
        {Array.from({ length: slotCount }, (_value, num) => (
          <Slot key={num} num={num} />
        ))}
      </Wrapper>,
    );
    const initialRenderCounts = [...renderCounts];

    act(() => {
      store.set(selectedAccountsAtom(), (current) => ({
        ...current,
        [targetNum]: {
          ...defaultSelectedAccount(),
          networkId: 'evm--1',
        },
      }));
    });

    expect(renderCounts[targetNum]).toBe(initialRenderCounts[targetNum] + 1);
    for (let num = 0; num < slotCount; num += 1) {
      if (num !== targetNum) {
        expect(renderCounts[num]).toBe(initialRenderCounts[num]);
      }
    }
  });
});
