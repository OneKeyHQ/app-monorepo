export function releaseSwapTokenListFetchEffectKey({
  effectKey,
  latestEffectKey,
}: {
  effectKey: string;
  latestEffectKey: string;
}) {
  return latestEffectKey === effectKey ? '' : latestEffectKey;
}

export function getSwapTokenSearchResults<T>({
  isTokenListFetchSettled,
  remoteTokens,
  searchLocalTokens,
  useLocalSearchFallback,
}: {
  isTokenListFetchSettled: boolean;
  remoteTokens: T[];
  searchLocalTokens: () => T[];
  useLocalSearchFallback: boolean;
}) {
  if (
    !useLocalSearchFallback ||
    remoteTokens.length > 0 ||
    isTokenListFetchSettled
  ) {
    return remoteTokens;
  }

  return searchLocalTokens();
}
