export type IMobileDetailTabKey = 'portfolio' | 'info' | 'protocol';

export function resolveVisibleTabKeys({
  hasPortfolio,
}: {
  hasPortfolio: boolean;
}): IMobileDetailTabKey[] {
  return hasPortfolio
    ? ['portfolio', 'info', 'protocol']
    : ['info', 'protocol'];
}

export function resolveDefaultTabKey({
  hasPortfolio,
}: {
  hasPortfolio: boolean;
}): IMobileDetailTabKey {
  return hasPortfolio ? 'portfolio' : 'info';
}

// The detail page stays mounted across account switches, so a tab the user
// picked can disappear under them (A has a position, B does not). Fall back to
// the default rather than rendering an empty body.
export function resolveActiveTabKey({
  selectedKey,
  visibleKeys,
  defaultKey,
}: {
  selectedKey: IMobileDetailTabKey | undefined;
  visibleKeys: IMobileDetailTabKey[];
  defaultKey: IMobileDetailTabKey;
}): IMobileDetailTabKey {
  if (selectedKey && visibleKeys.includes(selectedKey)) {
    return selectedKey;
  }
  return visibleKeys.includes(defaultKey) ? defaultKey : visibleKeys[0];
}
