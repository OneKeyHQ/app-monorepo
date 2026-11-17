export type IAllNetworkLastPublishedResult<T> = {
  result: Array<T> | null;
  runSignature: string;
};

export function resolveAllNetworkPublishedResult<T>({
  completedResult,
  hasQueuedRerun,
  lastPublished,
  runSignature,
  retainSupersededResult = false,
}: {
  completedResult: Array<T> | null;
  hasQueuedRerun: boolean;
  lastPublished: IAllNetworkLastPublishedResult<T> | undefined;
  runSignature: string;
  /**
   * Consumers that clear the retained result when a run is accepted have no
   * last-good snapshot left by the time a superseded run completes. Record
   * the superseded (unpublished) result as that snapshot so the queued run
   * can restore it if its own fan-out fails.
   */
  retainSupersededResult?: boolean;
}): {
  publishedResult: Array<T> | null | undefined;
  nextLastPublished: IAllNetworkLastPublishedResult<T> | undefined;
} {
  if (hasQueuedRerun) {
    return {
      publishedResult:
        lastPublished?.runSignature === runSignature
          ? lastPublished.result
          : undefined,
      nextLastPublished: retainSupersededResult
        ? { result: completedResult, runSignature }
        : lastPublished,
    };
  }

  const nextLastPublished = {
    result: completedResult,
    runSignature,
  };
  return {
    publishedResult: completedResult,
    nextLastPublished,
  };
}

/**
 * An accepted run invalidates the retained result BEFORE its fan-out starts.
 * When that fan-out then fails, the previously published result must be
 * restored — otherwise the consumer stays pinned on `undefined` until the
 * next successful must-run. The visible result is only restored while the
 * owner is unchanged AND the retained snapshot carries the current run
 * signature. `ownerUnchanged` only proves the failed runner still owns the
 * hook; the retained ref outlives account/network switches, so without the
 * signature check the first failed refresh after a switch would publish the
 * previous owner's snapshot under the new owner. The ref restore itself is
 * unconditional: the skip path and the publish path both re-check the run
 * signature before serving it.
 */
/**
 * Every per-network request of a fan-out failed. `continueOnError` turns each
 * rejection into `null`, so such a fan-out resolves with no results instead of
 * throwing — by the result alone it looks exactly like an owner with no
 * accounts. The request count tells the two apart: "no accounts" issues no
 * requests at all.
 */
export function isAllNetworkFanOutExhausted({
  requestCount,
  resultCount,
}: {
  requestCount: number;
  resultCount: number;
}): boolean {
  return requestCount > 0 && resultCount === 0;
}

export function resolveAllNetworkFailedRunRestore<T>({
  previousPublished,
  ownerUnchanged,
  currentRunSignature,
}: {
  previousPublished: IAllNetworkLastPublishedResult<T> | undefined;
  ownerUnchanged: boolean;
  currentRunSignature: string;
}): {
  nextLastPublished: IAllNetworkLastPublishedResult<T> | undefined;
  shouldRestoreResult: boolean;
} {
  return {
    nextLastPublished: previousPublished,
    shouldRestoreResult:
      ownerUnchanged &&
      previousPublished !== undefined &&
      previousPublished.runSignature === currentRunSignature,
  };
}
