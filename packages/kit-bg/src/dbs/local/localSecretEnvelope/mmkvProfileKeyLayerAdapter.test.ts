import {
  buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
  deleteMmkvProfileKeyForLocalSecretEnvelope,
  isMmkvProfileKeyLocalSecretEnvelopeLayerAvailable,
  parseLocalSecretEnvelopeV1,
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from '.';

import type { ILocalSecretEnvelopeMmkvProfileKeyStorage } from '.';

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

function buildMemoryMmkvProfileKeyStorage(): {
  records: Map<string, string>;
  storage: ILocalSecretEnvelopeMmkvProfileKeyStorage;
} {
  const records = new Map<string, string>();
  return {
    records,
    storage: {
      async getItem(keyRef) {
        return records.get(keyRef) ?? null;
      },
      async getOrCreateItem(keyRef, createKeyHex) {
        const existing = records.get(keyRef);
        if (existing) {
          return existing;
        }
        const keyHex = createKeyHex();
        records.set(keyRef, keyHex);
        return keyHex;
      },
      async removeItem(keyRef) {
        records.delete(keyRef);
      },
      async setItem(keyRef, keyHex) {
        records.set(keyRef, keyHex);
      },
      async supportStorage() {
        return true;
      },
    },
  };
}

describe('MMKV profile-key LSE layer', () => {
  it('uses one random profile key outside RealmDB for multiple envelopes', async () => {
    const { records, storage } = buildMemoryMmkvProfileKeyStorage();
    const keyRef = 'test:lse:mmkv-profile-key';
    const adapter = buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
      keyRef,
      keyStorage: storage,
      randomBytes: buildDeterministicRandomBytes(),
    });
    const plaintext = '|RP|current-kdf-payload';

    const firstEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext,
      recordId: 'hd-1',
      strength: 'profile-bound',
    });
    const secondEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|PK|current-kdf-payload',
      recordId: 'imported--evm--address',
      strength: 'profile-bound',
    });

    expect(records.size).toBe(1);
    expect(records.get(keyRef)?.length).toBe(64);
    expect(
      parseLocalSecretEnvelopeV1(firstEnvelope).wrappingLayers[0],
    ).toMatchObject({
      capabilities: {
        extractable: true,
        keyAccess: 'raw-key-readable',
        sync: 'local-only',
      },
      kind: 'mmkv-profile-key',
      keyRef,
    });
    expect(
      parseLocalSecretEnvelopeV1(secondEnvelope).wrappingLayers[0].keyRef,
    ).toBe(keyRef);
    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope: firstEnvelope,
        expectedDataType: 'credential',
        expectedRecordId: 'hd-1',
        resolveLayerAdapter: () => adapter,
      }),
    ).resolves.toBe(plaintext);
  });

  it('keeps the global profile key on per-record cleanup and supports explicit reset', async () => {
    const { records, storage } = buildMemoryMmkvProfileKeyStorage();
    const keyRef = 'test:lse:mmkv-profile-key:cleanup';
    const adapter = buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
      keyRef,
      keyStorage: storage,
    });
    records.set(keyRef, '11'.repeat(32));

    expect(adapter.deleteLayerKey).toBeUndefined();
    await expect(
      isMmkvProfileKeyLocalSecretEnvelopeLayerAvailable({
        keyStorage: storage,
      }),
    ).resolves.toBe(true);

    await deleteMmkvProfileKeyForLocalSecretEnvelope({
      keyRef,
      keyStorage: storage,
    });
    expect(records.has(keyRef)).toBe(false);
  });
});
