/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePersistedOwnerWorth } from './usePersistedOwnerWorth';

/*
yarn jest packages/kit/src/hooks/usePersistedOwnerWorth.test.tsx
*/

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccountProfile: {
      getAllNetworkAccountsValueByIndexedAccount: jest.fn(),
      getAllNetworkAccountsValueByAccountId: jest.fn(),
      getAccountsValue: jest.fn(),
    },
  },
}));

const profile = backgroundApiProxy.serviceAccountProfile as unknown as {
  getAllNetworkAccountsValueByIndexedAccount: jest.Mock;
  getAllNetworkAccountsValueByAccountId: jest.Mock;
  getAccountsValue: jest.Mock;
};

type IDeferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
function defer<T>(): IDeferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

const hdAllNetworks = {
  accountId: 'hd-1--m/44/60/0/0/8',
  indexedAccountId: 'hd-1--8',
  networkId: 'onekeyall--0',
  isAllNetworks: true,
};

beforeEach(() => {
  profile.getAllNetworkAccountsValueByIndexedAccount.mockReset();
  profile.getAllNetworkAccountsValueByAccountId.mockReset();
  profile.getAccountsValue.mockReset();
});

describe('usePersistedOwnerWorth', () => {
  it('reads the indexed-account All Networks value and classifies it', async () => {
    profile.getAllNetworkAccountsValueByIndexedAccount.mockResolvedValue({
      accountId: 'hd-1--8',
      value: { 'evm--1': '0', 'btc--0': '0' },
      currency: 'usd',
    });

    const { result } = renderHook(() => usePersistedOwnerWorth(hdAllNetworks));
    expect(result.current).toBeUndefined();

    await flush();

    expect(result.current).toBe('zero');
    expect(
      profile.getAllNetworkAccountsValueByIndexedAccount,
    ).toHaveBeenCalledWith({ indexedAccountId: 'hd-1--8' });
    expect(profile.getAccountsValue).not.toHaveBeenCalled();
  });

  it('reads the per-account value for Others accounts under All Networks', async () => {
    profile.getAllNetworkAccountsValueByAccountId.mockResolvedValue({
      accountId: 'imported--60--abc',
      value: { 'imported--60--abc_evm--1': '12' },
      currency: 'usd',
    });

    const { result } = renderHook(() =>
      usePersistedOwnerWorth({
        accountId: 'imported--60--abc',
        indexedAccountId: undefined,
        networkId: 'onekeyall--0',
        isAllNetworks: true,
      }),
    );
    await flush();

    expect(result.current).toBe('positive');
    expect(profile.getAllNetworkAccountsValueByAccountId).toHaveBeenCalledWith({
      accountId: 'imported--60--abc',
    });
  });

  it('reads the single-network scalar outside All Networks', async () => {
    profile.getAccountsValue.mockResolvedValue([
      { accountId: 'hd-1--m/44/60/0/0/8', value: '0', currency: 'usd' },
    ]);

    const { result } = renderHook(() =>
      usePersistedOwnerWorth({
        ...hdAllNetworks,
        networkId: 'evm--1',
        isAllNetworks: false,
      }),
    );
    await flush();

    expect(result.current).toBe('zero');
    expect(profile.getAccountsValue).toHaveBeenCalledWith({
      accounts: [{ accountId: 'hd-1--m/44/60/0/0/8', networkId: 'evm--1' }],
    });
  });

  it('never reports a previous owner after a switch', async () => {
    const first = defer<{ value: Record<string, string> }>();
    profile.getAllNetworkAccountsValueByIndexedAccount
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ value: undefined });

    const { result, rerender } = renderHook(
      (props: Parameters<typeof usePersistedOwnerWorth>[0]) =>
        usePersistedOwnerWorth(props),
      { initialProps: hdAllNetworks },
    );
    rerender({
      ...hdAllNetworks,
      accountId: 'hd-1--m/44/60/0/0/9',
      indexedAccountId: 'hd-1--9',
    });
    await flush();
    expect(result.current).toBeUndefined();

    // The first owner's read settles late; it must not leak into the new owner.
    await act(async () => {
      first.resolve({ value: { 'evm--1': '5' } });
      await Promise.resolve();
    });
    expect(result.current).toBeUndefined();
  });

  it('shares one read between concurrent subscribers of the same owner', async () => {
    const pending = defer<{ value: Record<string, string> }>();
    profile.getAllNetworkAccountsValueByIndexedAccount.mockReturnValue(
      pending.promise,
    );

    const a = renderHook(() => usePersistedOwnerWorth(hdAllNetworks));
    const b = renderHook(() => usePersistedOwnerWorth(hdAllNetworks));
    expect(
      profile.getAllNetworkAccountsValueByIndexedAccount,
    ).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ value: { 'evm--1': '0' } });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(a.result.current).toBe('zero');
    expect(b.result.current).toBe('zero');
  });

  it('treats a failed read as no evidence', async () => {
    profile.getAllNetworkAccountsValueByIndexedAccount.mockRejectedValue(
      new Error('boom'),
    );
    const { result } = renderHook(() => usePersistedOwnerWorth(hdAllNetworks));
    await flush();
    expect(result.current).toBeUndefined();
  });
});
