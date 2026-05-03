import { describe, expect, it } from '@jest/globals';

import {
  SERVICE_PERSISTENCE_FIELDS_WHITELIST,
  assertOnlyWhitelistedFields,
} from '../src/persistence-fields';

describe('persistence-fields whitelist', () => {
  it('exposes the exact 4-field whitelist (frozen contract)', () => {
    expect(SERVICE_PERSISTENCE_FIELDS_WHITELIST).toEqual([
      'keyBase64',
      'accessTokenSha256',
      'createdAt',
      'revokedAt',
    ]);
  });

  it('accepts a record containing only whitelisted fields', () => {
    expect(() =>
      assertOnlyWhitelistedFields({
        keyBase64: 'AAAA',
        accessTokenSha256: 'BBBB',
        createdAt: 1,
      }),
    ).not.toThrow();

    expect(() =>
      assertOnlyWhitelistedFields({
        keyBase64: 'AAAA',
        accessTokenSha256: 'BBBB',
        createdAt: 1,
        revokedAt: 2,
      }),
    ).not.toThrow();

    expect(() => assertOnlyWhitelistedFields({})).not.toThrow();
  });

  it('throws when ciphertextBase64 is present (the canonical leak)', () => {
    expect(() =>
      assertOnlyWhitelistedFields({
        keyBase64: 'AAAA',
        ciphertextBase64: 'LEAK',
      }),
    ).toThrow(/PersistenceWhitelistViolation.*ciphertextBase64/);
  });

  it('throws on every other forbidden field', () => {
    const forbiddenFields = [
      'mnemonic',
      'seedPhrase',
      'walletId',
      'displayAddress',
      'sourceLabel',
      'accessToken', // plaintext token must NEVER appear; only its sha256 may
    ];
    for (const field of forbiddenFields) {
      expect(() =>
        assertOnlyWhitelistedFields({
          keyBase64: 'AAAA',
          [field]: 'leak',
        }),
      ).toThrow(/PersistenceWhitelistViolation/);
    }
  });

  it('throws on non-object inputs (defense in depth)', () => {
    expect(() => assertOnlyWhitelistedFields(null)).toThrow(
      /PersistenceWhitelistViolation/,
    );
    expect(() => assertOnlyWhitelistedFields([])).toThrow(
      /PersistenceWhitelistViolation/,
    );
    expect(() => assertOnlyWhitelistedFields('string')).toThrow(
      /PersistenceWhitelistViolation/,
    );
    expect(() => assertOnlyWhitelistedFields(42)).toThrow(
      /PersistenceWhitelistViolation/,
    );
  });
});
