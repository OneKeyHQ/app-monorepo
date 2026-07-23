export const HOME_STORE_CACHE_ENVELOPE_SCHEMA_VERSION = 1 as const;

export type IHomeOpaqueCacheEnvelope = {
  key: string;
  schemaVersion: typeof HOME_STORE_CACHE_ENVELOPE_SCHEMA_VERSION;
  ownerScopeKey: string;
  createdAt: number;
  expiresAt: number;
  payload: string;
};

export function isHomeOpaqueCacheEnvelope(
  value: unknown,
): value is IHomeOpaqueCacheEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<IHomeOpaqueCacheEnvelope>;
  return (
    typeof candidate.key === 'string' &&
    candidate.key.length > 0 &&
    candidate.schemaVersion === HOME_STORE_CACHE_ENVELOPE_SCHEMA_VERSION &&
    typeof candidate.ownerScopeKey === 'string' &&
    candidate.ownerScopeKey.length > 0 &&
    Number.isSafeInteger(candidate.createdAt) &&
    Number.isSafeInteger(candidate.expiresAt) &&
    Number(candidate.expiresAt) > Number(candidate.createdAt) &&
    typeof candidate.payload === 'string'
  );
}
