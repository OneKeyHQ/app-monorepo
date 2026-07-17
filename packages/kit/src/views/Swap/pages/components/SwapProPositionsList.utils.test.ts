import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildStockPositionsMetadataOwnerKey,
  buildStockPositionsMetadataRequestKey,
  getExactStockPositionsMetadataSnapshot,
  getSwapProPositionsFailureState,
  isStockPositionsMetadataSnapshotUsable,
  isSwapProPositionsSourceReady,
  loadStockPositionsMetadataWithRetry,
  requireCompleteStockPositionsMetadataList,
  retrySwapProPositionsFailures,
  shouldRenderStockPositionsSkeleton,
  shouldRenderSwapProPositionsSourceSkeleton,
} from './SwapProPositionsList.utils';

const token = (networkId: string, contractAddress: string): ISwapToken =>
  ({
    networkId,
    contractAddress,
  }) as ISwapToken;

describe('SwapProPositionsList utils', () => {
  it('keeps an exact empty cache unresolved across re-entry until this mount settles', () => {
    const readinessBeforeRequest = isSwapProPositionsSourceReady({
      exactPositionTokenCount: 0,
      hasExactPositionSnapshot: true,
      hasSettledCurrentOwnerRequest: false,
      sourceUnavailable: false,
    });
    const readinessWhileCurrentRequestLoads = isSwapProPositionsSourceReady({
      exactPositionTokenCount: 0,
      hasExactPositionSnapshot: true,
      hasSettledCurrentOwnerRequest: false,
      sourceUnavailable: false,
    });

    expect(readinessBeforeRequest).toBe(false);
    expect(readinessWhileCurrentRequestLoads).toBe(false);
    expect(
      isSwapProPositionsSourceReady({
        exactPositionTokenCount: 0,
        hasExactPositionSnapshot: true,
        hasSettledCurrentOwnerRequest: true,
        sourceUnavailable: false,
      }),
    ).toBe(true);
  });

  it('uses a non-empty exact cache as last-good before this mount settles', () => {
    expect(
      isSwapProPositionsSourceReady({
        exactPositionTokenCount: 1,
        hasExactPositionSnapshot: true,
        hasSettledCurrentOwnerRequest: false,
        sourceUnavailable: false,
      }),
    ).toBe(true);
  });

  it('settles the source when no owner can be requested', () => {
    expect(
      isSwapProPositionsSourceReady({
        exactPositionTokenCount: 0,
        hasExactPositionSnapshot: false,
        hasSettledCurrentOwnerRequest: false,
        sourceUnavailable: true,
      }),
    ).toBe(true);
  });

  it('keeps the first unresolved owner on skeleton even before loading starts', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        hasUsableMetadataSnapshot: false,
        metadataPhase: 'idle',
        metadataRequired: false,
        sourceReady: false,
        stockOnly: true,
      }),
    ).toBe(true);
  });

  it('treats an exact settled empty source as ready', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        hasUsableMetadataSnapshot: false,
        metadataPhase: 'idle',
        metadataRequired: false,
        sourceReady: true,
        stockOnly: true,
      }),
    ).toBe(false);
  });

  it('keeps an exact empty cache stable during a scoped refresh', () => {
    expect(
      shouldRenderSwapProPositionsSourceSkeleton({
        hasScopedSource: true,
        hasUsableLegacyCache: false,
        legacyLoading: true,
        sourceReady: true,
        stockOnly: false,
      }),
    ).toBe(false);
  });

  it('keeps an unresolved scoped owner on skeleton before its request starts', () => {
    expect(
      shouldRenderSwapProPositionsSourceSkeleton({
        hasScopedSource: true,
        hasUsableLegacyCache: false,
        legacyLoading: false,
        sourceReady: false,
        stockOnly: true,
      }),
    ).toBe(true);
  });

  it('shows a skeleton while the first metadata request is unresolved', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        hasUsableMetadataSnapshot: false,
        metadataPhase: 'initial-loading',
        metadataRequired: true,
        sourceReady: true,
        stockOnly: true,
      }),
    ).toBe(true);
  });

  it('keeps a same-owner last-good snapshot visible during refresh', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        hasUsableMetadataSnapshot: true,
        metadataPhase: 'refreshing',
        metadataRequired: true,
        sourceReady: true,
        stockOnly: true,
      }),
    ).toBe(false);
  });

  it('restores an exact empty metadata result on same-scope re-entry', () => {
    const snapshot = {
      ownerKey: 'owner-a__network-a::all',
      requestKey: 'en-US::network-a:0xaa',
      data: [] as string[],
    };
    const restored = getExactStockPositionsMetadataSnapshot({
      ownerKey: snapshot.ownerKey,
      requestKey: snapshot.requestKey,
      snapshot,
    });

    expect(restored).toBe(snapshot);
    expect(
      shouldRenderStockPositionsSkeleton({
        hasUsableMetadataSnapshot: isStockPositionsMetadataSnapshotUsable({
          displayTokenCount: 0,
          isVisibleExact: true,
          visibleTokenIdentityCount: restored?.data.length,
        }),
        metadataPhase: 'refreshing',
        metadataRequired: true,
        sourceReady: true,
        stockOnly: true,
      }),
    ).toBe(false);
  });

  it('does not restore metadata across owner, token-set, or locale changes', () => {
    const snapshot = {
      ownerKey: 'owner-a__network-a::all',
      requestKey: 'en-US::network-a:0xaa',
      data: [] as string[],
    };

    expect(
      getExactStockPositionsMetadataSnapshot({
        ownerKey: 'owner-b__network-a::all',
        requestKey: snapshot.requestKey,
        snapshot,
      }),
    ).toBeUndefined();
    expect(
      getExactStockPositionsMetadataSnapshot({
        ownerKey: snapshot.ownerKey,
        requestKey: 'en-US::network-a:0xbb',
        snapshot,
      }),
    ).toBeUndefined();
    expect(
      getExactStockPositionsMetadataSnapshot({
        ownerKey: snapshot.ownerKey,
        requestKey: 'zh-CN::network-a:0xaa',
        snapshot,
      }),
    ).toBeUndefined();
  });

  it('retries a first metadata failure and returns the next complete result', async () => {
    const completeResult = [{ stock: false }];
    const load = jest
      .fn<Promise<typeof completeResult>, []>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(completeResult);

    await expect(
      loadStockPositionsMetadataWithRetry({
        load,
        maxAttempts: 2,
        retryDelayMs: 0,
      }),
    ).resolves.toBe(completeResult);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('stops metadata retries at the configured limit', async () => {
    const load = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(
      loadStockPositionsMetadataWithRetry({
        load,
        maxAttempts: 2,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow('offline');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('rejects sparse metadata even when the array length matches', () => {
    const sparseList: { stock: boolean }[] = [];
    sparseList[1] = { stock: false };

    expect(() =>
      requireCompleteStockPositionsMetadataList({
        expectedCount: 2,
        list: sparseList,
      }),
    ).toThrow('Stock positions metadata response is incomplete');
    expect(
      requireCompleteStockPositionsMetadataList({
        expectedCount: 2,
        list: [{ stock: false }, { stock: true }],
      }),
    ).toHaveLength(2);
  });

  it('keeps failures distinct from authoritative empty data', () => {
    expect(
      getSwapProPositionsFailureState({
        hasExactPositionSnapshot: false,
        hasUsableMetadataSnapshot: false,
        isExactPositionRequestFailed: true,
      }),
    ).toBe('blocking');
    expect(
      getSwapProPositionsFailureState({
        hasExactPositionSnapshot: true,
        hasUsableMetadataSnapshot: true,
        isExactPositionRequestFailed: false,
        metadataPhase: 'stale-error',
      }),
    ).toBe('stale');
    expect(
      getSwapProPositionsFailureState({
        hasExactPositionSnapshot: true,
        hasUsableMetadataSnapshot: true,
        isExactPositionRequestFailed: false,
        metadataPhase: 'ready',
      }),
    ).toBeUndefined();
    expect(
      getSwapProPositionsFailureState({
        hasExactPositionSnapshot: true,
        hasUsableMetadataSnapshot: false,
        isExactPositionRequestFailed: false,
        metadataPhase: 'stale-error',
      }),
    ).toBe('blocking');
  });

  it('blocks a combined raw and metadata failure when only raw last-good exists', () => {
    expect(
      getSwapProPositionsFailureState({
        hasExactPositionSnapshot: true,
        hasUsableMetadataSnapshot: false,
        isExactPositionRequestFailed: true,
        metadataPhase: 'failed',
      }),
    ).toBe('blocking');
    expect(
      getSwapProPositionsFailureState({
        hasExactPositionSnapshot: true,
        hasUsableMetadataSnapshot: true,
        isExactPositionRequestFailed: true,
        metadataPhase: 'stale-error',
      }),
    ).toBe('stale');
  });

  it('retries raw and metadata failures from one user action', () => {
    const onPositionSourceRetry = jest.fn();
    const onMetadataRetry = jest.fn();

    retrySwapProPositionsFailures({
      isExactPositionRequestFailed: true,
      metadataPhase: 'failed',
      onMetadataRetry,
      onPositionSourceRetry,
    });

    expect(onPositionSourceRetry).toHaveBeenCalledTimes(1);
    expect(onMetadataRetry).toHaveBeenCalledTimes(1);
  });

  it('does not reuse irrelevant metadata when the token identity changes', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        hasUsableMetadataSnapshot: false,
        metadataPhase: 'refreshing',
        metadataRequired: true,
        sourceReady: true,
        stockOnly: true,
      }),
    ).toBe(true);
  });

  it('does not reuse an old empty snapshot for a new token request', () => {
    expect(
      isStockPositionsMetadataSnapshotUsable({
        displayTokenCount: 0,
        isVisibleExact: false,
        visibleTokenIdentityCount: 0,
      }),
    ).toBe(false);
    expect(
      isStockPositionsMetadataSnapshotUsable({
        displayTokenCount: 0,
        isVisibleExact: true,
        visibleTokenIdentityCount: 0,
      }),
    ).toBe(true);
  });

  it('exits the skeleton after the first metadata request fails', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        hasUsableMetadataSnapshot: false,
        metadataPhase: 'failed',
        metadataRequired: true,
        sourceReady: true,
        stockOnly: true,
      }),
    ).toBe(false);
  });

  it('binds metadata identity to owner, filter, tokens, and locale', () => {
    expect(
      buildStockPositionsMetadataOwnerKey({
        sourceOwnerKey: 'account__network-b,network-a',
        filterToken: [token('network-b', '0xBB'), token('network-a', '0xAA')],
      }),
    ).toBe('account__network-b,network-a::network-a:0xaa,network-b:0xbb');
    expect(
      buildStockPositionsMetadataRequestKey({
        locale: 'en-US',
        tokens: [token('network-b', '0xBB'), token('network-a', '0xAA')],
      }),
    ).toBe('en-US::network-a:0xaa,network-b:0xbb');
  });
});
