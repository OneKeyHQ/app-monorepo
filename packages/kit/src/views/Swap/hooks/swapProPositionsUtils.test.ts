/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  advanceSwapProPositionsOwnerRequestScope,
  buildSwapProPositionsNetworkIdsKey,
  hasSwapProPositionsOwnerRequestSettledSince,
  isSwapProPositionsOwnerRequestScopeSettled,
  isSwapProPositionsRequestGenerationCurrent,
  isSwapProPositionsSourceUnavailable,
  mergeSwapProPositionTokenDetails,
  resolveSwapProPositionsAccountIdentity,
  useSwapProPositionsGenerationGuardedCallback,
} from './swapProPositionsUtils';

describe('swapProPositionsUtils', () => {
  it('uses one canonical selected indexed owner for fetch and cache', () => {
    expect(
      resolveSwapProPositionsAccountIdentity({
        selectedAccount: { indexedAccountId: 'selected-indexed' },
        activeAccount: {
          indexedAccount: { id: 'active-indexed' },
          account: { id: 'active-account' },
        },
      }),
    ).toEqual({
      accountId: 'selected-indexed',
      identityReady: true,
      indexedAccountId: 'selected-indexed',
      otherWalletTypeAccountId: undefined,
    });
  });

  it('prefers a selected external owner over a stale active indexed owner', () => {
    expect(
      resolveSwapProPositionsAccountIdentity({
        selectedAccount: { othersWalletAccountId: 'selected-external-b' },
        activeAccount: {
          indexedAccount: { id: 'stale-active-indexed-a' },
          account: { id: 'stale-active-account-a' },
        },
      }),
    ).toEqual({
      accountId: 'selected-external-b',
      identityReady: true,
      indexedAccountId: undefined,
      otherWalletTypeAccountId: 'selected-external-b',
    });
  });

  it('falls back through active indexed, account, and db account owners', () => {
    expect(
      resolveSwapProPositionsAccountIdentity({
        selectedAccount: {},
        activeAccount: {
          indexedAccount: { id: 'active-indexed' },
          account: { id: 'active-account' },
          dbAccount: { id: 'active-db' },
        },
      }).accountId,
    ).toBe('active-indexed');
    expect(
      resolveSwapProPositionsAccountIdentity({
        selectedAccount: {},
        activeAccount: {
          account: { id: 'active-account' },
          dbAccount: { id: 'active-db' },
        },
      }).accountId,
    ).toBe('active-account');
    expect(
      resolveSwapProPositionsAccountIdentity({
        selectedAccount: {},
        activeAccount: { dbAccount: { id: 'active-db' } },
      }).accountId,
    ).toBe('active-db');
  });

  it('builds a stable network identity independent of input order', () => {
    expect(
      buildSwapProPositionsNetworkIdsKey([
        { networkId: 'network-b' },
        { networkId: 'network-a' },
      ]),
    ).toBe('network-a,network-b');
  });

  it('distinguishes identity hydration from a settled no-wallet state', () => {
    expect(
      resolveSwapProPositionsAccountIdentity({
        selectedAccount: {},
        activeAccount: { ready: false },
      }).identityReady,
    ).toBe(false);
    expect(
      resolveSwapProPositionsAccountIdentity({
        selectedAccount: {},
        activeAccount: { ready: true },
      }),
    ).toEqual({
      accountId: undefined,
      identityReady: true,
      indexedAccountId: undefined,
      otherWalletTypeAccountId: undefined,
    });
  });

  it('does not treat an account with pending networks as unavailable', () => {
    expect(
      isSwapProPositionsSourceUnavailable({
        accountId: 'wallet-owner',
        identityReady: true,
      }),
    ).toBe(false);
    expect(
      isSwapProPositionsSourceUnavailable({
        identityReady: false,
      }),
    ).toBe(false);
    expect(
      isSwapProPositionsSourceUnavailable({
        identityReady: true,
      }),
    ).toBe(true);
  });

  it('requires a terminal owner request newer than the current mount baseline', () => {
    const baselineRequestId = 7;
    const buildState = (
      requestId: number,
      status: 'loading' | 'settled' | 'error',
      ownerKey = 'owner-a',
    ) => ({ ownerKey, requestId, status });

    expect(
      hasSwapProPositionsOwnerRequestSettledSince({
        baselineRequestId,
        currentRequestState: buildState(7, 'settled'),
        ownerKey: 'owner-a',
      }),
    ).toBe(false);
    expect(
      hasSwapProPositionsOwnerRequestSettledSince({
        baselineRequestId,
        currentRequestState: buildState(8, 'loading'),
        ownerKey: 'owner-a',
      }),
    ).toBe(false);
    expect(
      hasSwapProPositionsOwnerRequestSettledSince({
        baselineRequestId,
        currentRequestState: buildState(8, 'settled'),
        ownerKey: 'owner-a',
      }),
    ).toBe(true);
    expect(
      hasSwapProPositionsOwnerRequestSettledSince({
        baselineRequestId,
        currentRequestState: buildState(8, 'error'),
        ownerKey: 'owner-a',
      }),
    ).toBe(true);
    expect(
      hasSwapProPositionsOwnerRequestSettledSince({
        baselineRequestId,
        currentRequestState: buildState(8, 'settled', 'owner-b'),
        ownerKey: 'owner-a',
      }),
    ).toBe(false);
  });

  it('does not reuse a settled owner scope after switching A to B and back to A', () => {
    const ownerAScope = {
      baselineRequestId: 7,
      ownerKey: 'owner-a',
      sessionId: 0,
    };
    const settledOwnerAScope = ownerAScope;
    const ownerBScope = advanceSwapProPositionsOwnerRequestScope({
      currentRequestId: 8,
      currentScope: ownerAScope,
      ownerKey: 'owner-b',
    });
    const returnedOwnerAScope = advanceSwapProPositionsOwnerRequestScope({
      currentRequestId: 9,
      currentScope: ownerBScope,
      ownerKey: 'owner-a',
    });

    expect(ownerBScope.sessionId).toBe(1);
    expect(returnedOwnerAScope.sessionId).toBe(2);
    expect(
      isSwapProPositionsOwnerRequestScopeSettled({
        currentScope: returnedOwnerAScope,
        settledScope: settledOwnerAScope,
      }),
    ).toBe(false);
    expect(
      advanceSwapProPositionsOwnerRequestScope({
        currentRequestId: 10,
        currentScope: returnedOwnerAScope,
        ownerKey: 'owner-a',
      }),
    ).toBe(returnedOwnerAScope);
  });

  it('rejects a slow balance result from an older same-owner generation', async () => {
    let resolveOldRequest!: () => void;
    const oldRequest = new Promise<void>((resolve) => {
      resolveOldRequest = resolve;
    });
    const requestStateRef = {
      current: { ownerKey: 'owner-a__network-a', requestId: 1 },
    };
    const committed: string[] = [];
    const commitOldResult = async () => {
      await oldRequest;
      if (
        isSwapProPositionsRequestGenerationCurrent({
          current: requestStateRef.current,
          expectedOwnerKey: 'owner-a__network-a',
          expectedRequestId: 1,
        })
      ) {
        committed.push('old');
      }
    };

    const pendingOldCommit = commitOldResult();
    requestStateRef.current = {
      ownerKey: 'owner-a__network-a',
      requestId: 2,
    };
    resolveOldRequest();
    await pendingOldCommit;

    expect(committed).toEqual([]);
    expect(
      isSwapProPositionsRequestGenerationCurrent({
        current: requestStateRef.current,
        expectedOwnerKey: 'owner-a__network-a',
        expectedRequestId: 2,
      }),
    ).toBe(true);
  });

  it('rejects an owner A listener retained across an owner B rerender', () => {
    const requestStateRef = {
      current: { ownerKey: 'owner-a__network-a', requestId: 1 },
    };
    const fetchPositionBalance = jest.fn();
    const commitPositionBalance = jest.fn();
    const onCurrentGenerationEvent = jest.fn(
      (
        payload: { token: string },
        generation: { ownerKey: string; requestId: number },
      ) => {
        fetchPositionBalance(payload);
        commitPositionBalance(generation);
      },
    );
    const { result, rerender } = renderHook(
      ({ ownerKey }: { ownerKey: string }) =>
        useSwapProPositionsGenerationGuardedCallback<{ token: string }>({
          currentRequestStateRef: requestStateRef,
          onCurrentGenerationEvent,
          ownerKey,
        }),
      { initialProps: { ownerKey: 'owner-a__network-a' } },
    );
    const retainedOwnerAListener = result.current;

    requestStateRef.current = {
      ownerKey: 'owner-b__network-b',
      requestId: 2,
    };
    rerender({ ownerKey: 'owner-b__network-b' });

    act(() => {
      void retainedOwnerAListener({ token: 'owner-a-token' });
    });
    expect(onCurrentGenerationEvent).not.toHaveBeenCalled();
    expect(fetchPositionBalance).not.toHaveBeenCalled();
    expect(commitPositionBalance).not.toHaveBeenCalled();

    act(() => {
      void result.current({ token: 'owner-b-token' });
    });
    expect(onCurrentGenerationEvent).toHaveBeenCalledTimes(1);
    expect(onCurrentGenerationEvent).toHaveBeenCalledWith(
      { token: 'owner-b-token' },
      { ownerKey: 'owner-b__network-b', requestId: 2 },
    );
    expect(fetchPositionBalance).toHaveBeenCalledWith({
      token: 'owner-b-token',
    });
    expect(commitPositionBalance).toHaveBeenCalledWith({
      ownerKey: 'owner-b__network-b',
      requestId: 2,
    });
  });

  it('merges live balance fields without discarding cached token metadata', () => {
    expect(
      mergeSwapProPositionTokenDetails(
        [
          {
            networkId: 'evm--1',
            contractAddress: '0xstock',
            symbol: 'STOCK',
            decimals: 18,
            isNative: false,
            logoURI: 'cached-logo',
            balanceParsed: '1',
          },
        ],
        [
          {
            networkId: 'evm--1',
            contractAddress: '0xSTOCK',
            symbol: 'STOCK',
            decimals: 18,
            isNative: false,
            balanceParsed: '2',
            fiatValue: '20',
            price: '10',
          },
        ],
      ),
    ).toEqual([
      expect.objectContaining({
        logoURI: 'cached-logo',
        balanceParsed: '2',
        fiatValue: '20',
        price: '10',
      }),
    ]);
  });
});
