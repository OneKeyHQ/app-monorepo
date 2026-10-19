/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { IDeriveTypesCollapseState } from '@onekeyhq/kit-bg/src/services/ServiceToken';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';

import { useDeriveTypesCollapseState } from './useDeriveTypesCollapseState';

const mockGetDeriveTypesCollapseState = jest.fn<Promise<unknown>, unknown[]>();
let capturedLoader: (() => Promise<unknown>) | undefined;
let capturedDeps: unknown[] | undefined;
let capturedOptions: unknown;
let mockResult: unknown;

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      getDeriveTypesCollapseState: (...args: unknown[]) =>
        mockGetDeriveTypesCollapseState(...args),
    },
  },
}));

jest.mock('./usePromiseResult', () => ({
  usePromiseResult: (
    loader: () => Promise<unknown>,
    deps: unknown[],
    options: unknown,
  ) => {
    capturedLoader = loader;
    capturedDeps = deps;
    capturedOptions = options;
    return { result: mockResult };
  },
}));

const BTC = 'btc--0';
const LTC = 'ltc--0';
const HD_WALLET = 'hd-1';
const INDEXED_ACCOUNT = 'hd-1--0';
const QUERY_KEY = `${BTC}__${INDEXED_ACCOUNT}__0`;

const COLLAPSED_ON_TAPROOT = {
  collapsed: true,
  defaultNetworkAccount: { deriveType: 'BIP86' },
} as unknown as IDeriveTypesCollapseState;

function renderState(
  overrides: Partial<Parameters<typeof useDeriveTypesCollapseState>[0]> = {},
) {
  return renderHook(() =>
    useDeriveTypesCollapseState({
      networkId: BTC,
      walletId: HD_WALLET,
      indexedAccountId: INDEXED_ACCOUNT,
      ...overrides,
    }),
  ).result.current;
}

describe('useDeriveTypesCollapseState', () => {
  beforeEach(() => {
    mockGetDeriveTypesCollapseState.mockReset();
    capturedLoader = undefined;
    mockResult = undefined;
  });

  it('answers at once without the background where nothing can collapse', async () => {
    for (const overrides of [
      { networkId: LTC },
      { walletId: WALLET_TYPE_WATCHING },
      { enabled: false },
    ]) {
      const state = renderState(overrides);
      expect(state).toMatchObject({
        isReady: true,
        collapsed: false,
        isAddressTypeHidden: false,
      });
      await expect(capturedLoader?.()).resolves.toBeUndefined();
    }
    expect(mockGetDeriveTypesCollapseState).not.toHaveBeenCalled();
  });

  it('holds the address type back until this account has an answer', () => {
    expect(renderState()).toMatchObject({
      isReady: false,
      isAddressTypeHidden: true,
    });

    mockResult = {
      queryKey: `${BTC}__hd-1--1__0`,
      state: { collapsed: false },
    };
    expect(renderState()).toMatchObject({
      isReady: false,
      isAddressTypeHidden: true,
    });
  });

  it('hides only the default address type once collapsed', () => {
    mockResult = { queryKey: QUERY_KEY, state: COLLAPSED_ON_TAPROOT };

    expect(renderState()).toMatchObject({
      isReady: true,
      collapsed: true,
      isAddressTypeHidden: true,
    });
    expect(renderState({ activeDeriveType: 'BIP86' }).isAddressTypeHidden).toBe(
      true,
    );
    // The send page switched to another type on stale balances: keep it visible.
    expect(renderState({ activeDeriveType: 'BIP84' }).isAddressTypeHidden).toBe(
      false,
    );
  });

  it('keeps every address type when not collapsed', () => {
    mockResult = { queryKey: QUERY_KEY, state: { collapsed: false } };

    expect(renderState()).toMatchObject({
      isReady: true,
      collapsed: false,
      isAddressTypeHidden: false,
    });
  });

  it('asks the background for this account and tags the answer', async () => {
    mockGetDeriveTypesCollapseState.mockResolvedValue(COLLAPSED_ON_TAPROOT);
    renderState();

    await expect(capturedLoader?.()).resolves.toEqual({
      queryKey: QUERY_KEY,
      state: COLLAPSED_ON_TAPROOT,
    });
    expect(mockGetDeriveTypesCollapseState).toHaveBeenCalledWith({
      networkId: BTC,
      indexedAccountId: INDEXED_ACCOUNT,
    });
  });

  it('asks again per account, and on focus only when asked to', () => {
    renderState();
    expect(capturedDeps).toEqual([QUERY_KEY, BTC, INDEXED_ACCOUNT]);
    expect(capturedOptions).toEqual({ revalidateOnFocus: undefined });

    renderState({ indexedAccountId: 'hd-1--1', revalidateOnFocus: true });
    expect(capturedDeps).toEqual([`${BTC}__hd-1--1__0`, BTC, 'hd-1--1']);
    expect(capturedOptions).toEqual({ revalidateOnFocus: true });
  });

  it('drops the previous answer when the revision is bumped', async () => {
    mockResult = { queryKey: QUERY_KEY, state: COLLAPSED_ON_TAPROOT };
    expect(renderState().isReady).toBe(true);

    // The default type just changed: the old answer must not render, so the
    // address type stays held back until the new one arrives.
    expect(renderState({ revision: 1 })).toMatchObject({
      isReady: false,
      isAddressTypeHidden: true,
    });
    expect(capturedDeps).toEqual([
      `${BTC}__${INDEXED_ACCOUNT}__1`,
      BTC,
      INDEXED_ACCOUNT,
    ]);

    mockGetDeriveTypesCollapseState.mockResolvedValue({ collapsed: false });
    await expect(capturedLoader?.()).resolves.toEqual({
      queryKey: `${BTC}__${INDEXED_ACCOUNT}__1`,
      state: { collapsed: false },
    });
  });

  it('falls back to every address type when the background call fails', async () => {
    mockGetDeriveTypesCollapseState.mockRejectedValue(new Error('timeout'));
    renderState();

    await expect(capturedLoader?.()).resolves.toEqual({
      queryKey: QUERY_KEY,
      state: { collapsed: false },
    });
  });
});
