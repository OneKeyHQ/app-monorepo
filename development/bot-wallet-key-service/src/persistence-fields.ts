/**
 * Whitelist of fields that the service is permitted to persist per record in
 * `data/keys.json`. Any field outside this set MUST cause an immediate throw —
 * this is the single security gate enforcing PoC trust boundary §3
 * (no ciphertext / no mnemonic / no plaintext access token).
 */
export const SERVICE_PERSISTENCE_FIELDS_WHITELIST = [
  'keyBase64',
  'accessTokenSha256',
  'createdAt',
  'revokedAt',
] as const;

export type IServicePersistenceField =
  (typeof SERVICE_PERSISTENCE_FIELDS_WHITELIST)[number];

export type IServicePersistedRecord = {
  keyBase64: string;
  accessTokenSha256: string;
  createdAt: number;
  revokedAt?: number;
};

const WHITELIST_SET: ReadonlySet<string> = new Set(
  SERVICE_PERSISTENCE_FIELDS_WHITELIST,
);

/**
 * Throws if `record` contains any field outside the whitelist. Use at every
 * persistence boundary (write to disk, marshal to JSON) to make accidental
 * leaks of ciphertext / token / metadata impossible at runtime.
 */
export function assertOnlyWhitelistedFields(record: unknown): void {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(
      'PersistenceWhitelistViolation: record must be a non-array object',
    );
  }
  const keys = Object.keys(record as Record<string, unknown>);
  for (const key of keys) {
    if (!WHITELIST_SET.has(key)) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(
        `PersistenceWhitelistViolation: forbidden field "${key}" — only ${SERVICE_PERSISTENCE_FIELDS_WHITELIST.join(
          ', ',
        )} are allowed`,
      );
    }
  }
}
