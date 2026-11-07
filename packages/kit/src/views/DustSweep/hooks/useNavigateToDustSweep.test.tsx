/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  DustSweepEntryCapabilitiesProvider,
  useActiveAccountDustSweep,
} from './useNavigateToDustSweep';

const mockNavigate = jest.fn<Promise<void>, unknown[]>(async () => undefined);
let mockCapabilities: {
  result: { networkId: string }[] | undefined;
  isLoading: boolean;
};
let mockFocused = true;
let mockAccountId = 'account';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => mockCapabilities,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: mockAccountId },
      wallet: { id: 'hd-1' },
      network: { id: 'evm--1', isAllNetworks: false },
      indexedAccount: { id: 'indexed' },
    },
  }),
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isWatchingWallet: () => false,
    isExternalWallet: () => false,
  },
}));
jest.mock('../utils/navigateToDustSweep', () => ({
  navigateToDustSweep: (...args: unknown[]) => mockNavigate(...args),
}));

function wrapper({ children }: PropsWithChildren) {
  return (
    <DustSweepEntryCapabilitiesProvider isFocused={mockFocused}>
      {children}
    </DustSweepEntryCapabilitiesProvider>
  );
}

const supported = [{ networkId: 'evm--1' }];
const expectedParams = {
  accountId: 'account',
  walletId: 'hd-1',
  indexedAccountId: 'indexed',
  networkId: 'evm--1',
  entry: 'tokenListHeader',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCapabilities = { result: supported, isLoading: false };
  mockFocused = true;
  mockAccountId = 'account';
});

it('opens Dust Sweep right away when capabilities are current', async () => {
  const { result } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  expect(result.current.canDustSweep).toBe(true);
  await act(async () => {
    await result.current.openDustSweep('tokenListHeader');
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate.mock.calls[0][0]).toMatchObject({
    params: expectedParams,
  });
});

it('opens once immediately while capabilities revalidate', async () => {
  mockCapabilities = { result: supported, isLoading: true };
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  expect(result.current.canDustSweep).toBe(true);
  await act(async () => {
    await result.current.openDustSweep('tokenListHeader');
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate.mock.calls[0][0]).toMatchObject({
    params: expectedParams,
  });

  mockCapabilities = { result: supported, isLoading: false };
  rerender();
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('opens immediately when Home regains focus before revalidation starts', async () => {
  mockFocused = false;
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  mockFocused = true;
  rerender();
  await act(async () => {
    await result.current.openDustSweep('tokenListHeader');
  });
  mockCapabilities = { result: supported, isLoading: true };
  rerender();
  mockCapabilities = { result: supported, isLoading: false };
  rerender();
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('does not navigate when the network is unsupported', async () => {
  mockCapabilities = { result: [{ networkId: 'sol--101' }], isLoading: false };
  const { result } = renderHook(() => useActiveAccountDustSweep(), { wrapper });
  expect(result.current.canDustSweep).toBe(false);
  await act(async () => {
    await result.current.openDustSweep('tokenListHeader');
  });
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('does not open if the network becomes unsupported while the navigation module loads', async () => {
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  let opening: Promise<void> | undefined;
  act(() => {
    opening = result.current.openDustSweep('tokenListHeader');
    mockCapabilities = {
      result: [{ networkId: 'sol--101' }],
      isLoading: false,
    };
    rerender();
  });
  await act(async () => opening);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('deduplicates rapid taps while opening the page', async () => {
  const { result } = renderHook(() => useActiveAccountDustSweep(), { wrapper });
  await act(async () => {
    await Promise.all([
      result.current.openDustSweep('tokenListHeader'),
      result.current.openDustSweep('tokenListHeader'),
    ]);
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it.each(['account', 'focus'] as const)(
  'does not open a stale page if %s changes while loading the navigation module',
  async (change) => {
    const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
      wrapper,
    });
    let opening: Promise<void> | undefined;
    act(() => {
      opening = result.current.openDustSweep('tokenListHeader');
      if (change === 'account') mockAccountId = 'other-account';
      else mockFocused = false;
      rerender();
    });
    await act(async () => opening);
    expect(mockNavigate).not.toHaveBeenCalled();
  },
);

it('does not revive a pending tap after the account changes away and back', async () => {
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  let opening: Promise<void> | undefined;
  act(() => {
    opening = result.current.openDustSweep('tokenListHeader');
    mockAccountId = 'other-account';
    rerender();
  });
  act(() => {
    mockAccountId = 'account';
    rerender();
  });
  await act(async () => opening);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('allows a new account to open while an old account tap is pending', async () => {
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  let previous: Promise<void> | undefined;
  let next: Promise<void> | undefined;
  act(() => {
    previous = result.current.openDustSweep('tokenListHeader');
    mockAccountId = 'other-account';
    rerender();
  });
  act(() => {
    next = result.current.openDustSweep('tokenListHeader');
  });
  await act(async () => Promise.all([previous, next]));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate.mock.calls[0][0]).toMatchObject({
    params: { ...expectedParams, accountId: 'other-account' },
  });
});

it('does not revive a pending tap after Home loses and regains focus', async () => {
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  let opening: Promise<void> | undefined;
  act(() => {
    opening = result.current.openDustSweep('tokenListHeader');
    mockFocused = false;
    rerender();
  });
  act(() => {
    mockFocused = true;
    rerender();
  });
  await act(async () => opening);
  expect(mockNavigate).not.toHaveBeenCalled();
});
