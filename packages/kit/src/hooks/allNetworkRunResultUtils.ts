export type IAllNetworkLastPublishedResult<T> = {
  result: Array<T> | null;
  runSignature: string;
};

export function resolveAllNetworkPublishedResult<T>({
  completedResult,
  hasQueuedRerun,
  lastPublished,
  runSignature,
}: {
  completedResult: Array<T> | null;
  hasQueuedRerun: boolean;
  lastPublished: IAllNetworkLastPublishedResult<T> | undefined;
  runSignature: string;
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
      nextLastPublished: lastPublished,
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
 * owner is unchanged: a stale runner from a previous owner must not overwrite
 * the current owner's state (the ref restore alone is safe, because the
 * skip path re-checks the run signature before serving it).
 */
export function resolveAllNetworkFailedRunRestore<T>({
  previousPublished,
  ownerUnchanged,
}: {
  previousPublished: IAllNetworkLastPublishedResult<T> | undefined;
  ownerUnchanged: boolean;
}): {
  nextLastPublished: IAllNetworkLastPublishedResult<T> | undefined;
  shouldRestoreResult: boolean;
} {
  return {
    nextLastPublished: previousPublished,
    shouldRestoreResult: ownerUnchanged && previousPublished !== undefined,
  };
}
