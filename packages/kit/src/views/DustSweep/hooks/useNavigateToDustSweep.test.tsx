/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

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

it('holds a tap during a focus refresh and opens once it completes', async () => {
  mockCapabilities = { result: supported, isLoading: true };
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  // The entry stays available (not hidden or disabled) while revalidating.
  expect(result.current.canDustSweep).toBe(true);
  act(() => {
    void result.current.openDustSweep('tokenListHeader');
  });
  expect(mockNavigate).not.toHaveBeenCalled();

  mockCapabilities = { result: supported, isLoading: false };
  rerender();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  expect(mockNavigate.mock.calls[0][0]).toMatchObject({
    params: expectedParams,
  });
});

it('drops a held tap when the refreshed capabilities no longer support the network', async () => {
  mockCapabilities = { result: supported, isLoading: true };
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  act(() => {
    void result.current.openDustSweep('tokenListHeader');
  });

  mockCapabilities = { result: [{ networkId: 'sol--101' }], isLoading: false };
  rerender();
  await waitFor(() => expect(result.current.canDustSweep).toBe(false));
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('drops a held tap when Home loses focus before the refresh completes', async () => {
  mockCapabilities = { result: supported, isLoading: true };
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  act(() => {
    void result.current.openDustSweep('tokenListHeader');
  });

  mockFocused = false;
  rerender();
  mockFocused = true;
  mockCapabilities = { result: supported, isLoading: false };
  rerender();
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('drops a held tap when the account changes before the refresh completes', async () => {
  mockCapabilities = { result: supported, isLoading: true };
  const { result, rerender } = renderHook(() => useActiveAccountDustSweep(), {
    wrapper,
  });
  act(() => {
    void result.current.openDustSweep('tokenListHeader');
  });

  mockAccountId = 'other-account';
  rerender();
  mockCapabilities = { result: supported, isLoading: false };
  rerender();
  await act(async () => undefined);
  expect(mockNavigate).not.toHaveBeenCalled();
});
