function isHomeBalanceContributorRefreshing({
  kind,
  refresh,
}: {
  kind: 'idle' | 'loading' | 'partial' | 'ready' | 'empty' | 'error';
  refresh?: 'idle' | 'refreshing' | 'failed';
}): boolean {
  return (kind === 'ready' || kind === 'empty') && refresh === 'refreshing';
}

function shouldIncludeHomeBalanceOptionalContributor({
  capabilityReady,
  supported,
}: {
  capabilityReady: boolean;
  supported: boolean;
}): boolean {
  return capabilityReady && supported;
}

export {
  isHomeBalanceContributorRefreshing,
  shouldIncludeHomeBalanceOptionalContributor,
};
