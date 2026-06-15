import { describe, expect, test } from 'react-native-harness';

import {
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
  isSecureStorageLocalSecretEnvelopeLayerAvailable,
} from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/secureStorageLayerAdapter';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

const TEST_KEY_REF = 'onekey:lse:e2e:secure-storage:v1';
const TEST_RECORD_ID = 'lse-native-harness-record';
const TEST_AAD = 'lse-native-harness-aad';
const TEST_PLAINTEXT = 'native-lse-secret';

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function expectRejects(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    expect(true).toBe(false);
    return '';
  } catch (error) {
    const message = errorToMessage(error);
    expect(message.length).toBeGreaterThan(0);
    return message;
  }
}

describe('Local Secret Envelope native secure-storage layer', () => {
  test('wraps and unwraps through native secure storage', async () => {
    expect(await isSecureStorageLocalSecretEnvelopeLayerAvailable()).toBe(true);

    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      keyRef: TEST_KEY_REF,
    });
    const prepareParams = {
      dataType: 'credential' as const,
      layerIndex: 0,
      recordId: TEST_RECORD_ID,
    };
    const layer = await adapter.prepareLayer(prepareParams);

    try {
      const ciphertext = await adapter.encrypt({
        ...prepareParams,
        aad: TEST_AAD,
        layer,
        plaintext: TEST_PLAINTEXT,
      });
      expect(ciphertext).not.toBe(TEST_PLAINTEXT);

      const restored = await adapter.decrypt({
        ...prepareParams,
        aad: TEST_AAD,
        ciphertext,
        layer,
      });
      expect(restored).toBe(TEST_PLAINTEXT);

      const storedKey = await secureStorageInstance.getSecureItem(layer.keyRef);
      expect(storedKey?.length).toBe(64);
    } finally {
      await secureStorageInstance.removeSecureItem(layer.keyRef);
    }
  });

  test('fails to unwrap after the native secure-storage key is deleted', async () => {
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      keyRef: TEST_KEY_REF,
    });
    const prepareParams = {
      dataType: 'credential' as const,
      layerIndex: 0,
      recordId: `${TEST_RECORD_ID}:delete-key`,
    };
    const layer = await adapter.prepareLayer(prepareParams);

    try {
      const ciphertext = await adapter.encrypt({
        ...prepareParams,
        aad: TEST_AAD,
        layer,
        plaintext: TEST_PLAINTEXT,
      });

      await secureStorageInstance.removeSecureItem(layer.keyRef);
      const message = await expectRejects(() =>
        adapter.decrypt({
          ...prepareParams,
          aad: TEST_AAD,
          ciphertext,
          layer,
        }),
      );
      expect(message).toMatch(/kind=secure-storage/);
    } finally {
      await secureStorageInstance.removeSecureItem(layer.keyRef);
    }
  });
});
