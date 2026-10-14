/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import { useConnectExternalWallet } from './useConnectExternalWallet';

const mockConnect = jest.fn<Promise<never>, [unknown]>();

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
    serviceAccount: { addExternalAccount: jest.fn() },
  },
}));

jest.mock('../../states/jotai/contexts/accountSelector/actionsLazy', () => ({
  useAccountSelectorLazyAction: () => jest.fn(),
}));

jest.mock('../../states/jotai/contexts/accountSelector/atoms', () => ({
  useSelectedAccount: () => ({ selectedAccount: { networkId: 'evm--1' } }),
}));

function deferred() {
  let reject = (_error: Error) => {};
  const promise = new Promise<never>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

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
