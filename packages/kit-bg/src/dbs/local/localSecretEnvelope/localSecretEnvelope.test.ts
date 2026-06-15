import {
  LOCAL_SECRET_ENVELOPE_INNER_PREFIX,
  buildLocalSecretEnvelopeAadV1,
  buildLocalSecretEnvelopeProtectedHeaderV1,
  classifyLocalSecretEnvelopeMigrationCandidate,
  parseLocalSecretEnvelopeV1,
  rewrapLocalSecretEnvelopeV1,
  serializeLocalSecretEnvelopeV1,
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from '.';

import {
  ESecretEncryptPayloadFormat,
  encodePasswordAsync,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
} from '@onekeyhq/core/src/secret';
import { DEFAULT_VERIFY_STRING } from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  type ILocalSecretEnvelopeInnerPrefix,
  type ILocalSecretEnvelopeLayer,
  type ILocalSecretEnvelopeLayerAdapter,
  type ILocalSecretEnvelopeLayerKind,
  type ILocalSecretEnvelopeV1,
} from './types';

const passwordValue = 'test-password';

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
  {
    kind: 'keychain',
    keyRef: 'keychain:lse:v1',
    alg: 'AES-256-GCM',
    iv: 'keychain-iv',
    capabilities: {
      sync: 'cloud-sync',
      extractable: 'unknown',
      keyAccess: 'raw-key-readable',
      requireAuth: true,
    },
  },
];

function buildEnvelope({
  innerPrefix,
}: {
  innerPrefix?: ILocalSecretEnvelopeInnerPrefix;
} = {}): ILocalSecretEnvelopeV1 {
  const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
    dataType: 'credential',
    innerPrefix,
    recordId: 'hd-1',
    wrappingLayers,
  });
  return {
    version: 1,
    dataType: 'credential',
    ...(innerPrefix ? { innerPrefix } : undefined),
    recordId: 'hd-1',
    wrappingLayers,
    strength: 'device-bound',
    protectedHeader,
    ciphertext: 'ciphertext-with-auth-tag',
  };
}

function assertRecord(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OneKeyLocalError('Invalid mock layer payload');
  }
}

function encodeMockLayerPayload({
  aad,
  kind,
  keyRef,
  layerIndex,
  plaintext,
}: {
  aad: string;
  kind: ILocalSecretEnvelopeLayerKind;
  keyRef: string;
  layerIndex: number;
  plaintext: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      aad,
      kind,
      keyRef,
      layerIndex,
      plaintext,
    }),
    'utf8',
  ).toString('base64');
}

function decodeMockLayerPayload(value: string): {
  aad: string;
  kind: ILocalSecretEnvelopeLayerKind;
  keyRef: string;
  layerIndex: number;
  plaintext: string;
} {
  const parsed = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  assertRecord(parsed);
  const { aad, kind, keyRef, layerIndex, plaintext } = parsed;
  if (
    typeof aad !== 'string' ||
    typeof kind !== 'string' ||
    typeof keyRef !== 'string' ||
    typeof layerIndex !== 'number' ||
    typeof plaintext !== 'string'
  ) {
    throw new OneKeyLocalError('Invalid mock layer payload');
  }
  return {
    aad,
    kind: kind as ILocalSecretEnvelopeLayerKind,
    keyRef,
    layerIndex,
    plaintext,
  };
}

function buildMockLayerAdapter({
  calls,
  kind,
  keyRef,
}: {
  calls: string[];
  kind: ILocalSecretEnvelopeLayerKind;
  keyRef: string;
}): ILocalSecretEnvelopeLayerAdapter {
  return {
    kind,
    prepareLayer: async ({ layerIndex }) => {
      calls.push(`prepare:${kind}:${layerIndex}`);
      return {
        kind,
        keyRef,
        alg: 'AES-256-GCM',
        iv: `iv:${keyRef}:${layerIndex}`,
        capabilities: {
          sync: kind === 'keychain' ? 'cloud-sync' : 'unknown',
          extractable: kind === 'indexeddb-cryptokey' ? false : 'unknown',
          keyAccess:
            kind === 'indexeddb-cryptokey'
              ? 'opaque-decrypt'
              : 'raw-key-readable',
        },
      };
    },
    encrypt: async ({ aad, layer, layerIndex, plaintext }) => {
      calls.push(`encrypt:${kind}:${layerIndex}`);
      return encodeMockLayerPayload({
        aad,
        kind: layer.kind,
        keyRef: layer.keyRef,
        layerIndex,
        plaintext,
      });
    },
    encryptWithExistingKey: async ({ aad, layer, layerIndex, plaintext }) => {
      calls.push(`encrypt-existing:${kind}:${layerIndex}`);
      return encodeMockLayerPayload({
        aad,
        kind: layer.kind,
        keyRef: layer.keyRef,
        layerIndex,
        plaintext,
      });
    },
    decrypt: async ({ aad, ciphertext, layer, layerIndex }) => {
      calls.push(`decrypt:${kind}:${layerIndex}`);
      const payload = decodeMockLayerPayload(ciphertext);
      if (
        payload.aad !== aad ||
        payload.kind !== layer.kind ||
        payload.keyRef !== layer.keyRef ||
        payload.layerIndex !== layerIndex
      ) {
        throw new OneKeyLocalError('mock layer aad mismatch');
      }
      return payload.plaintext;
    },
  };
}

describe('localSecretEnvelope parser', () => {
  it('roundtrips an envelope with explicit wrapping layers', () => {
    const envelope = buildEnvelope();
    const serialized = serializeLocalSecretEnvelopeV1(envelope);
    const parsed = parseLocalSecretEnvelopeV1(serialized);

    expect(parsed).toEqual(envelope);
    expect(parsed.wrappingLayers).toHaveLength(2);
    expect(
      buildLocalSecretEnvelopeAadV1({
        dataType: parsed.dataType,
        recordId: parsed.recordId,
        protectedHeader: parsed.protectedHeader,
      }),
    ).toBe(
      '{"dataType":"credential","protectedHeader":"{\\"dataType\\":\\"credential\\",\\"recordId\\":\\"hd-1\\",\\"version\\":1,\\"wrappingLayers\\":[{\\"alg\\":\\"AES-256-GCM\\",\\"capabilities\\":{\\"extractable\\":false,\\"keyAccess\\":\\"opaque-decrypt\\",\\"sync\\":\\"unknown\\"},\\"iv\\":\\"cryptokey-iv\\",\\"keyRef\\":\\"indexeddb:device-key:v1\\",\\"kind\\":\\"indexeddb-cryptokey\\"},{\\"alg\\":\\"AES-256-GCM\\",\\"capabilities\\":{\\"extractable\\":\\"unknown\\",\\"keyAccess\\":\\"raw-key-readable\\",\\"requireAuth\\":true,\\"sync\\":\\"cloud-sync\\"},\\"iv\\":\\"keychain-iv\\",\\"keyRef\\":\\"keychain:lse:v1\\",\\"kind\\":\\"keychain\\"}]}","recordId":"hd-1"}',
    );
  });

  it('roundtrips an envelope with an exposed inner prefix', () => {
    const envelope = buildEnvelope({
      innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential,
    });
    const serialized = serializeLocalSecretEnvelopeV1(envelope);
    const parsed = parseLocalSecretEnvelopeV1(serialized);

    expect(serialized.startsWith('|LSE1|RP|')).toBe(true);
    expect(parsed).toEqual(envelope);
    expect(parsed.innerPrefix).toBe(
      LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential,
    );
    expect(() =>
      parseLocalSecretEnvelopeV1(serialized.replace('|LSE1|RP|', '|LSE1|PK|')),
    ).toThrow('Invalid local secret envelope exposed inner prefix');
  });

  it('rejects a protected header that does not match the stored fields', () => {
    const envelope = {
      ...buildEnvelope(),
      recordId: 'hd-2',
    };

    expect(() => serializeLocalSecretEnvelopeV1(envelope)).toThrow(
      'Invalid local secret envelope protected header',
    );
  });

  it('rejects unavailable strength as a persisted envelope', () => {
    expect(() =>
      serializeLocalSecretEnvelopeV1({
        ...buildEnvelope(),
        strength: 'unavailable',
      }),
    ).toThrow('Invalid local secret envelope unavailable strength');
  });
});

describe('localSecretEnvelope migration candidate classifier', () => {
  it('accepts only current-KDF HD, imported, TON mnemonic, and verifyString payloads', async () => {
    const password = await encodePasswordAsync({ password: passwordValue });
    const hdCredential = await encryptRevealableSeed({
      password,
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
    });
    const importedCredential = await encryptImportedCredential({
      password,
      credential: {
        privateKey: 'private-key-hex',
      },
    });
    const tonMnemonicCredential = await encryptRevealableSeed({
      password,
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'ton-seed-hex',
      },
    });
    const verifyString = await encryptVerifyString({ password });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'hd-1',
        rawValue: hdCredential,
      }),
    ).toEqual({
      canMigrate: true,
      dataType: 'credential',
      recordId: 'hd-1',
      innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential,
    });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'imported--evm--address',
        rawValue: importedCredential,
      }),
    ).toEqual({
      canMigrate: true,
      dataType: 'credential',
      recordId: 'imported--evm--address',
      innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential,
    });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'imported--ton--address--ton_credential',
        rawValue: tonMnemonicCredential,
      }),
    ).toEqual({
      canMigrate: true,
      dataType: 'credential',
      recordId: 'imported--ton--address--ton_credential',
      innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential,
    });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'verify-string',
        recordId: 'context-main',
        rawValue: verifyString,
      }),
    ).toEqual({
      canMigrate: true,
      dataType: 'verify-string',
      recordId: 'context-main',
      innerPrefix: LOCAL_SECRET_ENVELOPE_INNER_PREFIX.verifyString,
    });
  });

  it('rejects legacy KDF, default verifyString, LSE, and unsupported prefixes', async () => {
    const password = await encodePasswordAsync({ password: passwordValue });
    const legacyCredential = await encryptRevealableSeed({
      password,
      format: ESecretEncryptPayloadFormat.legacy,
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
    });
    const envelope = serializeLocalSecretEnvelopeV1(buildEnvelope());

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'hd-1',
        rawValue: legacyCredential,
      }),
    ).toEqual({ canMigrate: false, reason: 'needs_kdf_upgrade' });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'verify-string',
        recordId: 'context-main',
        rawValue: DEFAULT_VERIFY_STRING,
      }),
    ).toEqual({ canMigrate: false, reason: 'default_verify_string' });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'hd-1',
        rawValue: envelope,
      }),
    ).toEqual({ canMigrate: false, reason: 'already_lse' });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'hyperliquid-agent-1',
        rawValue: '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
      }),
    ).toEqual({ canMigrate: false, reason: 'unsupported_prefix' });
  });

  it('rejects mismatched credential ids and prefixes', async () => {
    const password = await encodePasswordAsync({ password: passwordValue });
    const importedCredential = await encryptImportedCredential({
      password,
      credential: {
        privateKey: 'private-key-hex',
      },
    });
    const verifyString = await encryptVerifyString({ password });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'hd-1',
        rawValue: importedCredential,
      }),
    ).toEqual({ canMigrate: false, reason: 'unsupported_record_id' });

    expect(
      classifyLocalSecretEnvelopeMigrationCandidate({
        dataType: 'credential',
        recordId: 'imported--evm--address',
        rawValue: verifyString,
      }),
    ).toEqual({ canMigrate: false, reason: 'unsupported_record_id' });
  });
});

describe('localSecretEnvelope wrapping pipeline', () => {
  it('wraps layers in order and unwraps them in reverse order', async () => {
    const calls: string[] = [];
    const adapters = [
      buildMockLayerAdapter({
        calls,
        kind: 'indexeddb-cryptokey',
        keyRef: 'indexeddb:device-key:v1',
      }),
      buildMockLayerAdapter({
        calls,
        kind: 'keychain',
        keyRef: 'keychain:lse:v1',
      }),
    ];
    const plaintext = '|RP|current-kdf-payload';

    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: adapters,
      plaintext,
      recordId: 'hd-1',
      strength: 'device-bound',
    });
    const parsed = parseLocalSecretEnvelopeV1(envelope);

    expect(envelope.startsWith('|LSE1|RP|')).toBe(true);
    expect(parsed.innerPrefix).toBe(
      LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential,
    );
    expect(parsed.ciphertext).not.toBe(plaintext);
    expect(parsed.wrappingLayers.map((layer) => layer.kind)).toEqual([
      'indexeddb-cryptokey',
      'keychain',
    ]);
    expect(calls).toEqual([
      'prepare:indexeddb-cryptokey:0',
      'prepare:keychain:1',
      'encrypt:indexeddb-cryptokey:0',
      'encrypt:keychain:1',
    ]);

    const adaptersByKind = new Map(
      adapters.map((adapter) => [adapter.kind, adapter]),
    );
    const unwrapped = await unwrapLocalSecretEnvelopeV1({
      envelope,
      resolveLayerAdapter: (layer) => adaptersByKind.get(layer.kind),
    });

    expect(unwrapped).toBe(plaintext);
    expect(calls.slice(4)).toEqual([
      'decrypt:keychain:1',
      'decrypt:indexeddb-cryptokey:0',
    ]);
  });

  it('binds layer metadata through protected header and AAD', async () => {
    const calls: string[] = [];
    const adapter = buildMockLayerAdapter({
      calls,
      kind: 'indexeddb-cryptokey',
      keyRef: 'indexeddb:device-key:v1',
    });
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|RP|current-kdf-payload',
      recordId: 'hd-1',
      strength: 'profile-bound',
    });
    const parsed = parseLocalSecretEnvelopeV1(envelope);
    const tamperedWrappingLayers = parsed.wrappingLayers.map((layer) => ({
      ...layer,
      iv: `${layer.iv}:tampered`,
    }));
    const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
      dataType: parsed.dataType,
      innerPrefix: parsed.innerPrefix,
      recordId: parsed.recordId,
      wrappingLayers: tamperedWrappingLayers,
    });
    const tamperedEnvelope = serializeLocalSecretEnvelopeV1({
      ...parsed,
      wrappingLayers: tamperedWrappingLayers,
      protectedHeader,
    });

    const unwrapPromise = unwrapLocalSecretEnvelopeV1({
      envelope: tamperedEnvelope,
      resolveLayerAdapter: () => adapter,
    });
    await expect(unwrapPromise).rejects.toThrow(
      'Local secret envelope layer decrypt failed: kind=indexeddb-cryptokey, index=0',
    );
    await expect(unwrapPromise).rejects.not.toThrow('indexeddb:device-key:v1');
  });

  it('rewraps with existing layer keys and fresh IVs', async () => {
    const calls: string[] = [];
    const adapters = [
      buildMockLayerAdapter({
        calls,
        kind: 'indexeddb-cryptokey',
        keyRef: 'indexeddb:device-key:v1',
      }),
      buildMockLayerAdapter({
        calls,
        kind: 'keychain',
        keyRef: 'keychain:lse:v1',
      }),
    ];
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: adapters,
      plaintext: '|RP|old-current-kdf-payload',
      recordId: 'hd-1',
      strength: 'device-bound',
    });
    const original = parseLocalSecretEnvelopeV1(envelope);
    const adaptersByKind = new Map(
      adapters.map((adapter) => [adapter.kind, adapter]),
    );
    calls.length = 0;

    const rewrapped = await rewrapLocalSecretEnvelopeV1({
      envelope,
      plaintext: '|RP|new-current-kdf-payload',
      randomBytes: (length) => new Uint8Array(length).fill(7),
      resolveLayerAdapter: (layer) => adaptersByKind.get(layer.kind),
    });
    const parsed = parseLocalSecretEnvelopeV1(rewrapped);

    expect(parsed.wrappingLayers.map((layer) => layer.keyRef)).toEqual(
      original.wrappingLayers.map((layer) => layer.keyRef),
    );
    expect(parsed.wrappingLayers.map((layer) => layer.iv)).toEqual([
      '070707070707070707070707',
      '070707070707070707070707',
    ]);
    expect(calls).toEqual([
      'encrypt-existing:indexeddb-cryptokey:0',
      'encrypt-existing:keychain:1',
    ]);
    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope: rewrapped,
        resolveLayerAdapter: (layer) => adaptersByKind.get(layer.kind),
      }),
    ).resolves.toBe('|RP|new-current-kdf-payload');
  });

  it('fails fast when a persisted layer has no available adapter', async () => {
    const calls: string[] = [];
    const adapter = buildMockLayerAdapter({
      calls,
      kind: 'indexeddb-cryptokey',
      keyRef: 'indexeddb:device-key:v1',
    });
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'verify-string',
      layerAdapters: [adapter],
      plaintext: '|VS|current-kdf-payload',
      recordId: 'context-main',
      strength: 'profile-bound',
    });

    const unwrapPromise = unwrapLocalSecretEnvelopeV1({
      envelope,
      resolveLayerAdapter: () => undefined,
    });
    await expect(unwrapPromise).rejects.toThrow(
      'Local secret envelope layer adapter is unavailable: kind=indexeddb-cryptokey, index=0',
    );
    await expect(unwrapPromise).rejects.not.toThrow('indexeddb:device-key:v1');
  });

  it('reports the failing layer kind without leaking keyRef on decrypt errors', async () => {
    const calls: string[] = [];
    const adapter = buildMockLayerAdapter({
      calls,
      kind: 'indexeddb-cryptokey',
      keyRef: 'indexeddb:device-key:v1',
    });
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'verify-string',
      layerAdapters: [adapter],
      plaintext: '|VS|current-kdf-payload',
      recordId: 'context-main',
      strength: 'profile-bound',
    });
    const failingAdapter = {
      ...adapter,
      decrypt: async () => {
        throw new OneKeyLocalError(
          'Local secret envelope CryptoKey unavailable: keyRef=indexeddb:device-key:v1',
        );
      },
    } satisfies ILocalSecretEnvelopeLayerAdapter;

    const unwrapPromise = unwrapLocalSecretEnvelopeV1({
      envelope,
      resolveLayerAdapter: () => failingAdapter,
    });

    await expect(unwrapPromise).rejects.toThrow(
      'Local secret envelope layer decrypt failed: kind=indexeddb-cryptokey, index=0',
    );
    await expect(unwrapPromise).rejects.not.toThrow('indexeddb:device-key:v1');
  });

  it('does not produce pass-through LSE without a wrapping layer', async () => {
    await expect(
      wrapLocalSecretEnvelopeV1({
        dataType: 'credential',
        layerAdapters: [],
        plaintext: '|PK|current-kdf-payload',
        recordId: 'imported--evm--address',
        strength: 'unavailable',
      }),
    ).rejects.toThrow(
      'Local secret envelope requires at least one wrapping layer',
    );
  });
});
