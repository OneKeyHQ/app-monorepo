import {
  assertPortableCredential,
  normalizePortableCredential,
} from './portableCredential';

describe('portableCredential guard', () => {
  it('accepts portable inner credentials', () => {
    expect(
      normalizePortableCredential({
        credential: '|RP|portable-current-kdf-payload',
      }),
    ).toBe('|RP|portable-current-kdf-payload');
    expect(
      normalizePortableCredential({
        credential: { credential: '|PK|portable-current-kdf-payload' },
      }),
    ).toBe('|PK|portable-current-kdf-payload');
    expect(normalizePortableCredential({ credential: undefined })).toBe(
      undefined,
    );
  });

  it('rejects raw local secret envelope credentials', () => {
    expect(() =>
      assertPortableCredential({
        credential: '|LSE1|{"keyRef":"indexeddb:key"}',
      }),
    ).toThrow('Cannot export raw local secret envelope credential');
    expect(() =>
      normalizePortableCredential({
        credential: { credential: '|LSE1|{"keyRef":"keychain:key"}' },
        errorMessage: 'Cannot transfer raw local secret envelope credential',
      }),
    ).toThrow('Cannot transfer raw local secret envelope credential');
  });
});
