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
