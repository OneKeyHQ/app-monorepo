import {
  buildLocalSecretEnvelopeAesGcmLayerAdapter,
  parseLocalSecretEnvelopeV1,
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from '.';

import { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';

import type {
  ILocalSecretEnvelopeAesGcmKeyStorage,
  ILocalSecretEnvelopeLayerCapabilities,
} from '.';

const capabilities: ILocalSecretEnvelopeLayerCapabilities = {
  sync: 'unknown',
  extractable: 'unknown',
  keyAccess: 'raw-key-readable',
};

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

function buildMemoryKeyStorage({
  supported = true,
}: {
  supported?: boolean;
} = {}): {
  records: Map<string, string>;
  keyStorage: ILocalSecretEnvelopeAesGcmKeyStorage;
} {
  const records = new Map<string, string>();
  return {
    records,
    keyStorage: {
      getItem: async (keyRef) => records.get(keyRef) ?? null,
      setItem: async (keyRef, keyHex) => {
        records.set(keyRef, keyHex);
      },
      supportStorage: async () => supported,
    },
  };
}

describe('buildLocalSecretEnvelopeAesGcmLayerAdapter', () => {
  it('wraps with AES-GCM while storing only the wrapping key outside the DB envelope', async () => {
    const { keyStorage, records } = buildMemoryKeyStorage();
    const adapter = buildLocalSecretEnvelopeAesGcmLayerAdapter({
      capabilities,
      keyRef: 'test:lse:secure-storage:global-key',
      keyStorage,
      kind: 'secure-storage',
      randomBytes: buildDeterministicRandomBytes(),
    });
    const plaintext = '|RP|current-kdf-payload';

    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext,
      recordId: 'hd-1',
      strength: 'secure-storage-bound',
    });
    const parsed = parseLocalSecretEnvelopeV1(envelope);

    expect(records.size).toBe(1);
    expect(parsed.ciphertext).not.toContain(plaintext);
    expect(parsed.wrappingLayers[0]).toMatchObject({
      alg: 'AES-256-GCM',
      capabilities,
      kind: 'secure-storage',
    });
    expect(parsed.wrappingLayers[0].keyRef).toBe(
      'test:lse:secure-storage:global-key',
    );

    const inner = await unwrapLocalSecretEnvelopeV1({
      envelope,
      expectedDataType: 'credential',
      expectedRecordId: 'hd-1',
      resolveLayerAdapter: () => adapter,
    });
    expect(inner).toBe(plaintext);
  });

  it('fails fast when the wrapping key is missing', async () => {
    const { keyStorage, records } = buildMemoryKeyStorage();
    const adapter = buildLocalSecretEnvelopeAesGcmLayerAdapter({
      capabilities,
      keyRef: 'test:lse:secure-storage:missing-key',
      keyStorage,
      kind: 'secure-storage',
      randomBytes: buildDeterministicRandomBytes(),
    });
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|PK|current-kdf-payload',
      recordId: 'imported--evm--address',
      strength: 'secure-storage-bound',
    });
    records.clear();

    const unwrapPromise = unwrapLocalSecretEnvelopeV1({
      envelope,
      expectedDataType: 'credential',
      expectedRecordId: 'imported--evm--address',
      resolveLayerAdapter: () => adapter,
    });
    await expect(unwrapPromise).rejects.toBeInstanceOf(
      LocalSecretEnvelopeUnavailable,
    );
    await expect(unwrapPromise).rejects.toThrow(
      'Local secret envelope wrapping key unavailable: kind=secure-storage',
    );
    await expect(unwrapPromise).rejects.not.toThrow(
      /test:lse:secure-storage:missing-key/,
    );
  });

  it('does not prepare an LSE layer when the key storage is unavailable', async () => {
    const { keyStorage } = buildMemoryKeyStorage({ supported: false });
    const adapter = buildLocalSecretEnvelopeAesGcmLayerAdapter({
      capabilities,
      keyRef: 'test:lse:secure-storage:unsupported',
      keyStorage,
      kind: 'secure-storage',
      randomBytes: buildDeterministicRandomBytes(),
    });

    await expect(
      wrapLocalSecretEnvelopeV1({
        dataType: 'verify-string',
        layerAdapters: [adapter],
        plaintext: '|VS|current-kdf-payload',
        recordId: 'context-main',
        strength: 'secure-storage-bound',
      }),
    ).rejects.toThrow(
      'Local secret envelope key storage unavailable: kind=secure-storage',
    );
  });
});
