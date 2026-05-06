import { expectTypeOf } from 'expect-type';

import type {
  IVaultCacheEntry,
  IVaultMetadata,
  IVaultPlaintext,
  IVaultRecord,
} from '../types';

describe('vault types', () => {
  it('keeps IVaultCacheEntry exact without soft expiry fields', () => {
    expectTypeOf<IVaultCacheEntry>().toEqualTypeOf<{
      hdCredentialBlob: string;
      issuedAt: number;
      expiresAt: number;
    }>();

    const entry: IVaultCacheEntry = {
      hdCredentialBlob: 'blob',
      issuedAt: 1,
      expiresAt: 2,
    };
    expect(Object.keys(entry)).toEqual([
      'hdCredentialBlob',
      'issuedAt',
      'expiresAt',
    ]);
  });

  it('keeps record and metadata shapes explicit', () => {
    expectTypeOf<IVaultRecord>().toEqualTypeOf<{
      walletId: string;
      accessToken: string;
      ciphertextBase64: string;
      createdAt: number;
    }>();

    expectTypeOf<IVaultMetadata>().toEqualTypeOf<{
      activeWalletId: string | null;
      activeKeyId: string | null;
      schemaVersion: 1;
      vaultCreatedAt: number;
    }>();
  });

  it('keeps IVaultPlaintext keyed by records, cache, and session labels', () => {
    expectTypeOf<IVaultPlaintext['records']>().toEqualTypeOf<
      Record<string, IVaultRecord>
    >();
    expectTypeOf<IVaultPlaintext['cache']>().toEqualTypeOf<
      Record<string, IVaultCacheEntry>
    >();
    expectTypeOf<IVaultPlaintext['schemaVersion']>().toEqualTypeOf<1>();
  });
});
