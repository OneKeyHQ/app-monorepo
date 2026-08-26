import {
  buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
  buildLocalSecretEnvelopeAadV1,
  buildLocalSecretEnvelopeAesGcmLayerAdapter,
  deleteIndexedDbCryptoKeyForLocalSecretEnvelope,
  isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable,
  parseLocalSecretEnvelopeV1,
  readIndexedDbCryptoKeyForLocalSecretEnvelope,
  unwrapLocalSecretEnvelopeV1,
  upgradeLocalSecretEnvelopeLayerTopologyV1,
  wrapLocalSecretEnvelopeV1,
} from '.';

import { IDBFactory } from 'fake-indexeddb';

import { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';

function buildDeterministicRandomBytes(): (length: number) => Uint8Array {
  let offset = 1;
  return (length: number) => {
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = (offset + index) % 256;
    }
    offset += length;
    return bytes;
  };
}

let testDbNameSeq = 0;

function buildAdapter({
  dbName = `test-lse-cryptokey-${(testDbNameSeq += 1)}`,
  indexedDBInstance = new IDBFactory(),
}: {
  dbName?: string;
  indexedDBInstance?: IDBFactory;
} = {}) {
  const adapter = buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter({
    dbName,
    indexedDBInstance,
    keyRefPrefix: 'test:lse:indexeddb-cryptokey',
    randomBytes: buildDeterministicRandomBytes(),
  });
  return { adapter, dbName, indexedDBInstance };
}

describe('buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter', () => {
  it('stores an extractable:false CryptoKey and unwraps its own payload', async () => {
    const { adapter, dbName, indexedDBInstance } = buildAdapter();
    const plaintext = '|RP|current-kdf-payload';

    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext,
      recordId: 'hd-1',
      strength: 'profile-bound',
    });
    const parsed = parseLocalSecretEnvelopeV1(envelope);
    const [layer] = parsed.wrappingLayers;
    const storedKey = await readIndexedDbCryptoKeyForLocalSecretEnvelope({
      dbName,
      indexedDBInstance,
      keyRef: layer.keyRef,
    });

    expect(storedKey).toBeDefined();
    await expect(
      globalThis.crypto.subtle.exportKey('raw', storedKey as CryptoKey),
    ).rejects.toThrow();
    expect(layer).toMatchObject({
      alg: 'AES-256-GCM',
      capabilities: {
        extractable: false,
        keyAccess: 'opaque-decrypt',
        sync: 'unknown',
      },
      kind: 'indexeddb-cryptokey',
    });
    expect(layer.keyRef).toMatch(/^test:lse:indexeddb-cryptokey:/);

    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope,
        expectedDataType: 'credential',
        expectedRecordId: 'hd-1',
        resolveLayerAdapter: () => adapter,
      }),
    ).resolves.toBe(plaintext);
  });

  it('fails when AAD or IV does not match', async () => {
    const { adapter } = buildAdapter();
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|PK|current-kdf-payload',
      recordId: 'imported--60--public-key',
      strength: 'profile-bound',
    });
    const parsed = parseLocalSecretEnvelopeV1(envelope);
    const [layer] = parsed.wrappingLayers;
    const aad = buildLocalSecretEnvelopeAadV1({
      dataType: parsed.dataType,
      protectedHeader: parsed.protectedHeader,
      recordId: parsed.recordId,
    });

    await expect(
      adapter.decrypt({
        aad: `${aad}:tampered`,
        ciphertext: parsed.ciphertext,
        dataType: parsed.dataType,
        layer,
        layerIndex: 0,
        recordId: parsed.recordId,
      }),
    ).rejects.toThrow();
    await expect(
      adapter.decrypt({
        aad,
        ciphertext: parsed.ciphertext,
        dataType: parsed.dataType,
        layer: {
          ...layer,
          iv: '000000000000000000000000',
        },
        layerIndex: 0,
        recordId: parsed.recordId,
      }),
    ).rejects.toThrow();
  });

  it('keeps the original CryptoKey usable when adding a secure-storage layer', async () => {
    const { adapter, dbName, indexedDBInstance } = buildAdapter();
    const secureStorageRecords = new Map<string, string>();
    const secureStorageAdapter = buildLocalSecretEnvelopeAesGcmLayerAdapter({
      capabilities: {
        extractable: 'unknown',
        keyAccess: 'raw-key-readable',
        sync: 'unknown',
      },
      keyRef: 'test:lse:secure-storage:global-key',
      keyStorage: {
        getItem: async (keyRef) => secureStorageRecords.get(keyRef) ?? null,
        getOrCreateItem: async (keyRef, createKeyHex) => {
          const existing = secureStorageRecords.get(keyRef);
          if (existing) {
            return existing;
          }
          const created = createKeyHex();
          secureStorageRecords.set(keyRef, created);
          return created;
        },
        setItem: async (keyRef, keyHex) => {
          secureStorageRecords.set(keyRef, keyHex);
        },
      },
      kind: 'secure-storage',
      randomBytes: buildDeterministicRandomBytes(),
    });
    const originalPlaintext = '|RP|old-current-kdf-payload';
    const nextPlaintext = '|RP|new-current-kdf-payload';
    const originalEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: originalPlaintext,
      recordId: 'hd-1',
      strength: 'profile-bound',
    });
    const original = parseLocalSecretEnvelopeV1(originalEnvelope);

    const upgradedEnvelope = await upgradeLocalSecretEnvelopeLayerTopologyV1({
      envelope: originalEnvelope,
      layerAdapters: [adapter, secureStorageAdapter],
      plaintext: nextPlaintext,
      strength: 'secure-storage-bound',
    });
    const upgraded = parseLocalSecretEnvelopeV1(upgradedEnvelope);

    expect(upgraded.wrappingLayers[0].keyRef).toBe(
      original.wrappingLayers[0].keyRef,
    );
    await expect(
      readIndexedDbCryptoKeyForLocalSecretEnvelope({
        dbName,
        indexedDBInstance,
        keyRef: original.wrappingLayers[0].keyRef,
      }),
    ).resolves.toBeDefined();
    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope: originalEnvelope,
        resolveLayerAdapter: () => adapter,
      }),
    ).resolves.toBe(originalPlaintext);
    const adaptersByKind = new Map(
      [adapter, secureStorageAdapter].map((layerAdapter) => [
        layerAdapter.kind,
        layerAdapter,
      ]),
    );
    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope: upgradedEnvelope,
        resolveLayerAdapter: (layer) => adaptersByKind.get(layer.kind),
      }),
    ).resolves.toBe(nextPlaintext);
  });

  it('throws retryable unavailable after the IndexedDB CryptoKey is deleted', async () => {
    const { adapter, dbName, indexedDBInstance } = buildAdapter();
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'verify-string',
      layerAdapters: [adapter],
      plaintext: '|VS|current-kdf-payload',
      recordId: 'context-main',
      strength: 'profile-bound',
    });
    const parsed = parseLocalSecretEnvelopeV1(envelope);

    await deleteIndexedDbCryptoKeyForLocalSecretEnvelope({
      dbName,
      indexedDBInstance,
      keyRef: parsed.wrappingLayers[0].keyRef,
    });

    const unwrapPromise = unwrapLocalSecretEnvelopeV1({
      envelope,
      expectedDataType: 'verify-string',
      expectedRecordId: 'context-main',
      resolveLayerAdapter: () => adapter,
    });
    // A missing CryptoKey must surface as a retryable LocalSecretEnvelopeUnavailable
    // (not a generic decrypt failure): web/ext rely solely on this layer, and a
    // generic error during unlock is treated as a wrong password and could trigger
    // the wrong-password protection / silent app reset.
    await expect(unwrapPromise).rejects.toBeInstanceOf(
      LocalSecretEnvelopeUnavailable,
    );
    await expect(unwrapPromise).rejects.toThrow(
      'Local secret envelope wrapping key unavailable: kind=indexeddb-cryptokey',
    );
    await expect(unwrapPromise).rejects.not.toThrow(
      /^test:lse:indexeddb-cryptokey:/,
    );
  });

  it('returns unavailable when IndexedDB or WebCrypto is missing', async () => {
    await expect(
      isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable({
        indexedDBInstance: null,
      }),
    ).resolves.toBe(false);
    await expect(
      isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable({
        cryptoGlobal: null,
      }),
    ).resolves.toBe(false);
  });
});
