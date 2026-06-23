import {
  LOCAL_SECRET_ENVELOPE_INNER_PREFIX,
  buildLocalSecretEnvelopeProtectedHeaderV1,
  serializeLocalSecretEnvelopeV1,
} from '.';

import {
  assertPortableCredential,
  normalizePortableCredential,
  shouldUnwrapCredentialForPortableExport,
} from './portableCredential';

import type {
  ILocalSecretEnvelopeInnerPrefix,
  ILocalSecretEnvelopeLayer,
} from './types';

const wrappingLayers: ILocalSecretEnvelopeLayer[] = [
  {
    kind: 'indexeddb-cryptokey',
    keyRef: 'indexeddb:device-key:v1',
    alg: 'AES-256-GCM',
    iv: 'cryptokey-iv',
    capabilities: {
      sync: 'unknown',
      extractable: false,
      keyAccess: 'opaque-decrypt',
    },
  },
];

function buildEnvelope({
  innerPrefix,
}: {
  innerPrefix?: ILocalSecretEnvelopeInnerPrefix;
} = {}) {
  const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
    dataType: 'credential',
    innerPrefix,
    recordId: 'hd-1',
    wrappingLayers,
  });
  return serializeLocalSecretEnvelopeV1({
    version: 1,
    dataType: 'credential',
    ...(innerPrefix ? { innerPrefix } : undefined),
    recordId: 'hd-1',
    wrappingLayers,
    strength: 'profile-bound',
    protectedHeader,
    ciphertext: 'ciphertext-with-auth-tag',
  });
}

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
    ).toThrow('This credential type cannot be exported');
    expect(() =>
      normalizePortableCredential({
        credential: { credential: '|LSE1|{"keyRef":"keychain:key"}' },
      }),
    ).not.toThrow();
    expect(
      normalizePortableCredential({
        credential: { credential: '|LSE1|{"keyRef":"keychain:key"}' },
      }),
    ).toBeUndefined();
  });

  it('filters non-portable credential prefixes', () => {
    expect(() =>
      assertPortableCredential({
        credential: '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
      }),
    ).toThrow('This credential type cannot be exported');
    expect(
      normalizePortableCredential({
        credential: '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
      }),
    ).toBeUndefined();
    expect(
      normalizePortableCredential({
        credential: '|VS|verify-string-payload',
      }),
    ).toBeUndefined();
    expect(
      normalizePortableCredential({
        credential: '|UNKNOWN|payload',
      }),
    ).toBeUndefined();
  });

  it('uses exposed LSE inner prefixes to decide whether unwrap is needed', () => {
    expect(
      shouldUnwrapCredentialForPortableExport(
        buildEnvelope({
          innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential,
        }),
      ),
    ).toBe(true);
    expect(
      shouldUnwrapCredentialForPortableExport(
        buildEnvelope({
          innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential,
        }),
      ),
    ).toBe(true);
    expect(
      shouldUnwrapCredentialForPortableExport(
        buildEnvelope({
          innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.verifyString,
        }),
      ),
    ).toBe(false);
    expect(shouldUnwrapCredentialForPortableExport(buildEnvelope())).toBe(true);
    expect(
      shouldUnwrapCredentialForPortableExport('|LSE1|{"keyRef":"invalid"}'),
    ).toBe(false);
  });
});
