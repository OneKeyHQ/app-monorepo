// Kept out of SimpleDbEntityPrivacyChainKeys so callers do not load the entity eagerly.
export function buildPrivacyChainStorageKey({
  accountId,
  scope,
}: {
  accountId: string;
  scope?: string;
}): string {
  return scope ? `${accountId}::${scope}` : accountId;
}
