/**
 * Batch-mode request factory for `useAllNetworkRequests` (pure, testable).
 *
 * One factory issues one batched request and feeds the progressive-paint
 * pipeline once per network result, exactly as the per-network factories do.
 * Both the cold executor (no `onSettled`) and the warm sliding window use it,
 * so the warm path must not also feed results through `onSettled`.
 */
export interface IMakeBatchRequestFactoryParams<T, B> {
  batch: B;
  allNetworkRequestsBatch: (args: {
    batch: B;
    allNetworkDataInit?: boolean;
  }) => Promise<Array<T | undefined>>;
  onRequestSettled?: (result: T, generation: number) => void;
  runGeneration: number;
  // Read at execution time, not when the factory is built.
  getAllNetworkDataInit: () => boolean;
}

export function makeBatchRequestFactory<T, B>(
  params: IMakeBatchRequestFactoryParams<T, B>,
): () => Promise<T[]> {
  const {
    batch,
    allNetworkRequestsBatch,
    onRequestSettled,
    runGeneration,
    getAllNetworkDataInit,
  } = params;
  return () =>
    allNetworkRequestsBatch({
      batch,
      allNetworkDataInit: getAllNetworkDataInit(),
    }).then((results) => {
      const settled: T[] = [];
      for (const result of results ?? []) {
        if (result !== undefined && result !== null) {
          onRequestSettled?.(result, runGeneration);
          settled.push(result);
        }
      }
      return settled;
    });
}
