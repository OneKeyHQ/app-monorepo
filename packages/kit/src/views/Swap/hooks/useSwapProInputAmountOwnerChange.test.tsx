import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react-native';
import { createStore } from 'jotai';

import { ProviderJotaiContextSwap } from '../../../states/jotai/contexts/swap/atoms';

import { useSwapProInputAmountOwnerChange } from './useSwapProInputAmountOwnerChange';

function createWrapperWithStore() {
  const store = createStore();

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
  }

  return { Wrapper };
}

describe('useSwapProInputAmountOwnerChange', () => {
  it('preserves the draft when the same account remounts the Pro tab', () => {
    const onOwnerChange = jest.fn();
    const { Wrapper } = createWrapperWithStore();
    const { unmount } = renderHook<void, { accountOwnerKey: string }>(
      ({ accountOwnerKey }) =>
        useSwapProInputAmountOwnerChange({
          accountOwnerKey,
          enabled: true,
          onOwnerChange,
        }),
      {
        initialProps: {
          accountOwnerKey: 'indexed:account-a',
        },
        wrapper: Wrapper,
      },
    );
    unmount();

    renderHook(
      () =>
        useSwapProInputAmountOwnerChange({
          accountOwnerKey: 'indexed:account-a',
          enabled: true,
          onOwnerChange,
        }),
      {
        wrapper: Wrapper,
      },
    );

    expect(onOwnerChange).not.toHaveBeenCalled();
  });

  it('clears the draft when an unsupported owner changes across a remount', () => {
    const onOwnerChange = jest.fn();
    const { Wrapper } = createWrapperWithStore();
    const { unmount } = renderHook(
      () =>
        useSwapProInputAmountOwnerChange({
          accountOwnerKey: 'account:unsupported-owner',
          enabled: true,
          onOwnerChange,
        }),
      {
        wrapper: Wrapper,
      },
    );
    unmount();

    renderHook(
      () =>
        useSwapProInputAmountOwnerChange({
          accountOwnerKey: 'indexed:supported-owner',
          enabled: true,
          onOwnerChange,
        }),
      {
        wrapper: Wrapper,
      },
    );

    expect(onOwnerChange).toHaveBeenCalledTimes(1);
  });

  it('clears the draft after a different account resolves', () => {
    const onOwnerChange = jest.fn();
    const { Wrapper } = createWrapperWithStore();
    const { rerender } = renderHook<void, { accountOwnerKey: string }>(
      ({ accountOwnerKey }) =>
        useSwapProInputAmountOwnerChange({
          accountOwnerKey,
          enabled: true,
          onOwnerChange,
        }),
      {
        initialProps: {
          accountOwnerKey: 'indexed:account-a',
        },
        wrapper: Wrapper,
      },
    );

    rerender({
      accountOwnerKey: '',
    });
    expect(onOwnerChange).not.toHaveBeenCalled();

    rerender({
      accountOwnerKey: 'indexed:account-b',
    });
    expect(onOwnerChange).toHaveBeenCalledTimes(1);
  });

  it('does not clear when the initial account resolves asynchronously', () => {
    const onOwnerChange = jest.fn();
    const { Wrapper } = createWrapperWithStore();
    const { rerender } = renderHook<void, { accountOwnerKey: string }>(
      ({ accountOwnerKey }) =>
        useSwapProInputAmountOwnerChange({
          accountOwnerKey,
          enabled: true,
          onOwnerChange,
        }),
      {
        initialProps: {
          accountOwnerKey: '',
        },
        wrapper: Wrapper,
      },
    );

    rerender({
      accountOwnerKey: 'indexed:account-a',
    });

    expect(onOwnerChange).not.toHaveBeenCalled();
  });

  it('defers an owner change while Pro is inactive and clears on re-entry', () => {
    const onOwnerChange = jest.fn();
    const { Wrapper } = createWrapperWithStore();
    const { rerender } = renderHook<
      void,
      {
        accountOwnerKey: string;
        enabled: boolean;
      }
    >(
      ({ accountOwnerKey, enabled }) =>
        useSwapProInputAmountOwnerChange({
          accountOwnerKey,
          enabled,
          onOwnerChange,
        }),
      {
        initialProps: {
          accountOwnerKey: 'indexed:account-a',
          enabled: true,
        },
        wrapper: Wrapper,
      },
    );

    rerender({
      accountOwnerKey: 'indexed:account-b',
      enabled: false,
    });
    expect(onOwnerChange).not.toHaveBeenCalled();

    rerender({
      accountOwnerKey: 'indexed:account-b',
      enabled: true,
    });
    expect(onOwnerChange).toHaveBeenCalledTimes(1);
  });
});
