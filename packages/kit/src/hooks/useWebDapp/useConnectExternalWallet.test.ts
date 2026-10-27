/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { resetOnboardingModal } from '@onekeyhq/components';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import { useConnectExternalWallet } from './useConnectExternalWallet';

import type backgroundApiProxy from '../../background/instance/backgroundApiProxy';

const mockConnect = jest.fn<Promise<unknown>, [unknown]>();
const mockSelectAccount = jest.fn();
const mockAddExternalAccount = jest.fn<
  ReturnType<typeof backgroundApiProxy.serviceAccount.addExternalAccount>,
  Parameters<typeof backgroundApiProxy.serviceAccount.addExternalAccount>
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Connect wallet' }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  resetOnboardingModal: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/hooks/useUserWalletProfile', () => ({
  useUserWalletProfile: () => ({ isSoftwareWalletOnlyUser: true }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useOnboardingConnectWalletLoadingAtom: () => {
    const { useState } = jest.requireActual<typeof import('react')>('react');
    return useState(false);
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: {
      wallet: {
        onboard: jest.fn(),
        addWalletStarted: jest.fn(),
        walletAdded: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { getAccountCompatibleNetwork: jest.fn() },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDappSide: {
      connectExternalWallet: (arg: unknown) => mockConnect(arg),
    },
    serviceAccount: {
      addExternalAccount: (
        ...args: Parameters<
          typeof backgroundApiProxy.serviceAccount.addExternalAccount
        >
      ) => mockAddExternalAccount(...args),
    },
  },
}));

jest.mock('../../states/jotai/contexts/accountSelector/actionsLazy', () => ({
  useAccountSelectorLazyAction: () => mockSelectAccount,
}));

jest.mock('../../states/jotai/contexts/accountSelector/atoms', () => ({
  useSelectedAccount: () => ({ selectedAccount: { networkId: 'evm--1' } }),
}));

function deferred<T = never>() {
  let resolve = (_value: T) => {};
  let reject = (_error: Error) => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

it('does not commit an older successful connection after a retry starts', async () => {
  jest.clearAllMocks();
  const first = deferred<unknown>();
  mockConnect
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(new Promise(() => undefined));
  const info = {
    walletConnect: { isNewConnection: true },
  } as IExternalConnectionInfo;
  const { result, unmount } = renderHook(() => useConnectExternalWallet());
  let oldResult: Promise<unknown> | undefined;
  act(() => {
    oldResult = result.current.connectToWallet(info);
  });
  act(() => {
    void result.current.connectToWallet(info);
  });
  await act(async () => {
    first.resolve({ accountInfo: { addresses: { 'evm--1': '0x1234' } } });
    await expect(oldResult).resolves.toBe(false);
  });
  expect(mockAddExternalAccount).not.toHaveBeenCalled();
  expect(mockSelectAccount).not.toHaveBeenCalled();
  expect(resetOnboardingModal).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(true);
  unmount();
});

it('does not select an older account if a retry starts while it is being saved', async () => {
  jest.clearAllMocks();
  type ISavedAccount = Awaited<
    ReturnType<typeof backgroundApiProxy.serviceAccount.addExternalAccount>
  >;
  const saving = deferred<ISavedAccount>();
  mockAddExternalAccount.mockReturnValueOnce(saving.promise);
  mockConnect
    .mockResolvedValueOnce({
      accountInfo: { addresses: { 'evm--1': '0x1234' } },
    })
    .mockReturnValueOnce(new Promise(() => undefined));
  const info = {
    walletConnect: { isNewConnection: true },
  } as IExternalConnectionInfo;
  const { result, unmount } = renderHook(() => useConnectExternalWallet());
  let oldResult: Promise<unknown> | undefined;
  act(() => {
    oldResult = result.current.connectToWallet(info);
  });
  await waitFor(() => expect(mockAddExternalAccount).toHaveBeenCalledTimes(1));
  act(() => {
    void result.current.connectToWallet(info);
  });
  await act(async () => {
    saving.resolve({ accounts: [{ id: 'old-account' }] } as ISavedAccount);
    await expect(oldResult).resolves.toBe(false);
  });
  expect(mockSelectAccount).not.toHaveBeenCalled();
  expect(resetOnboardingModal).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(true);
  unmount();
});

it('keeps retry loading when an older connection settles', async () => {
  jest.useFakeTimers();
  const first = deferred();
  const second = deferred();
  mockConnect
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const info = {
    walletConnect: { isNewConnection: true },
  } as IExternalConnectionInfo;
  const { result, unmount } = renderHook(() => useConnectExternalWallet());
  let oldResult: Promise<unknown> | undefined;
  let retryResult: Promise<unknown> | undefined;
  act(() => {
    oldResult = result.current
      .connectToWallet(info)
      .catch((error: unknown) => error);
  });
  act(() => {
    retryResult = result.current
      .connectToWallet(info)
      .catch((error: unknown) => error);
  });
  await act(async () => {
    first.reject(new Error('Old connection failed'));
    await oldResult;
    jest.advanceTimersByTime(1000);
  });
  expect(result.current.loading).toBe(true);
  expect(result.current.localLoading).toBe(true);
  await act(async () => {
    second.reject(new Error('Current connection failed'));
    await retryResult;
    jest.advanceTimersByTime(1000);
  });
  expect(result.current.loading).toBe(false);
  unmount();
  jest.useRealTimers();
});

it('prevents a queued older selection from committing after a retry starts', async () => {
  jest.clearAllMocks();
  const queued = deferred<void>();
  const committed = jest.fn();
  mockSelectAccount.mockImplementationOnce(
    async (_name: string, payload: { shouldCommit?: () => boolean }) => {
      await queued.promise;
      if (!payload.shouldCommit || payload.shouldCommit()) committed();
    },
  );
  mockAddExternalAccount.mockResolvedValueOnce({
    accounts: [{ id: 'old-account' }],
  } as Awaited<
    ReturnType<typeof backgroundApiProxy.serviceAccount.addExternalAccount>
  >);
  mockConnect
    .mockResolvedValueOnce({
      accountInfo: { addresses: { 'evm--1': '0x1234' } },
    })
    .mockReturnValueOnce(new Promise(() => undefined));
  const info = {
    walletConnect: { isNewConnection: true },
  } as IExternalConnectionInfo;
  const { result, unmount } = renderHook(() => useConnectExternalWallet());
  let oldResult: Promise<unknown> | undefined;
  act(() => {
    oldResult = result.current.connectToWallet(info);
  });
  await waitFor(() => expect(mockSelectAccount).toHaveBeenCalledTimes(1));
  act(() => {
    void result.current.connectToWallet(info);
  });
  await act(async () => {
    queued.resolve();
    await expect(oldResult).resolves.toBe(false);
  });
  expect(committed).not.toHaveBeenCalled();
  expect(resetOnboardingModal).not.toHaveBeenCalled();
  unmount();
});
