/**
 * COLD-path per-network request factory (pure, testable).
 *
 * Extracted from `useAllNetworkRequests` so the load-bearing invariant of the
 * cold (cache-empty / freshly-created-account) fan-out can be unit-tested
 * without React. The WARM (steady-state) fan-out feeds the progressive-paint
 * pipeline via the sliding-window executor's `onSettled`; the cold executor
 * (`promiseAllSettledEnhanced`) has NO `onSettled`, so each cold factory must
 * call `onRequestSettled` itself when it resolves. Omitting this is the bug
 * this unit guards: a freshly-created account (no token cache → cold path) then
 * fetches data that never reaches the progressive view → no structure frame →
 * `listStructure.ownerKey` never advances → the home list is stuck on skeleton.
 *
 * Placeholder rounds (`includingNonExistingAccount`: empty accountId/apiAddress)
 * carry no data and must NOT be fed — they would pollute the materialized view
 * with a `''__networkId` key. The filter lives HERE (factory level) because the
 * response no longer carries the per-network accountId/apiAddress.
 */

export interface IColdRequestNetworkInfo {
  accountId: string;
  networkId: string;
  apiAddress: string;
}

export interface IMakeColdRequestFactoryParams<T> {
  networkInfo: IColdRequestNetworkInfo;
  /** the per-network live fetch (the hook's `allNetworkRequests`). */
  allNetworkRequests: (args: {
    accountId: string;
    networkId: string;
    allNetworkDataInit?: boolean;
  }) => Promise<T | undefined>;
  /** progressive-paint feed (only invoked for real, data-bearing rounds). */
  onRequestSettled?: (result: T, generation: number) => void;
  /** monotonic run generation threaded to the consumer's LWW view. */
  runGeneration: number;
  /** read `allNetworkDataInit.current` at EXECUTION time (not factory-build). */
  getAllNetworkDataInit: () => boolean;
  /** optional side-channel (e.g. native log) fired once per fed network. */
  onFed?: (networkId: string) => void;
}

/**
 * Build a thunk that runs the per-network fetch and, on resolve, feeds the
 * progressive pipeline for real (non-placeholder, non-empty) results. Returns
 * the raw result unchanged so the caller's `respTemp` accumulation is intact.
 */
export function makeColdRequestFactory<T>(
  params: IMakeColdRequestFactoryParams<T>,
): () => Promise<T | undefined> {
  const {
    networkInfo,
    allNetworkRequests,
    onRequestSettled,
    runGeneration,
    getAllNetworkDataInit,
    onFed,
  } = params;
  const { accountId, networkId, apiAddress } = networkInfo;
  const isPlaceholder = !accountId || !apiAddress;
  return () =>
    allNetworkRequests({
      accountId,
      networkId,
      allNetworkDataInit: getAllNetworkDataInit(),
    }).then((res) => {
      if (res && !isPlaceholder) {
        onFed?.(networkId);
        onRequestSettled?.(res, runGeneration);
      }
      return res;
    });
}
