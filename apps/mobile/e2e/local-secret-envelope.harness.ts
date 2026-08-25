import { describe, expect, test } from 'react-native-harness';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
  deleteMmkvProfileKeyForLocalSecretEnvelope,
} from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/mmkvProfileKeyLayerAdapter';
import {
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
  isSecureStorageLocalSecretEnvelopeLayerAvailable,
} from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/secureStorageLayerAdapter';
import { localSecretEnvelopeService } from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/service';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

const TEST_KEY_REF = 'onekey_lse_e2e_secure_storage_v1';
const TEST_MMKV_KEY_REF = 'onekey_lse_e2e_mmkv_profile_key_v1';
const TEST_RECORD_ID = 'lse-native-harness-record';
const TEST_AAD = 'lse-native-harness-aad';
const TEST_PLAINTEXT = 'native-lse-secret';

function getDevOnlyPassword(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}-onekey-debug`;
}

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
  test('migrates and signs a legacy HyperLiquid Agent credential through the background LocalDB', async () => {
    const report =
      await backgroundApiProxy.serviceE2E.runHyperLiquidAgentMigrationSelfTest(
        {
          $$devOnlyPassword: getDevOnlyPassword(),
        },
        {
          expectedCredentialLayerKinds: ['mmkv-profile-key', 'secure-storage'],
          expectedRuntimePlatform: 'native',
          expectedStrength: 'secure-storage-bound',
        },
      );
    const failedCheckpoints = report.checkpoints.filter(
      (checkpoint) => checkpoint.status === 'failed',
    );

    expect(failedCheckpoints).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.runtimePlatform).toBe('native');
    expect(report.summary?.legacySourceStored).toBe(true);
    expect(report.summary?.rawCredentialIsLse).toBe(true);
    expect(report.summary?.expectedInnerPrefix).toBe('|HLP|');
    expect(report.summary?.migratedInnerPrefix).toBe('|HLP|');
    expect(report.summary?.credentialLayerKinds).toEqual([
      'mmkv-profile-key',
      'secure-storage',
    ]);
    expect(report.summary?.credentialStrength).toBe('secure-storage-bound');
    expect(report.summary?.privateKeyAbsentFromEnvelope).toBe(true);
    expect(report.summary?.readBackMatches).toBe(true);
    expect(report.summary?.signatureVerified).toBe(true);
  });

  test('composes the MMKV base layer before native secure storage', async () => {
    localSecretEnvelopeService.clearCapabilityCache();
    const config =
      await localSecretEnvelopeService.buildCredentialMigrationConfig();

    expect(config?.runtimePlatform).toBe('native');
    expect(config?.layerAdapters.map((adapter) => adapter.kind)).toEqual([
      'mmkv-profile-key',
      'secure-storage',
    ]);
    expect(config?.strength).toBe('secure-storage-bound');
  });

  test('wraps and unwraps through the dedicated native MMKV key store', async () => {
    const adapter = buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
      keyRef: TEST_MMKV_KEY_REF,
    });
    const prepareParams = {
      dataType: 'credential' as const,
      layerIndex: 0,
      recordId: `${TEST_RECORD_ID}-mmkv`,
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
    } finally {
      await deleteMmkvProfileKeyForLocalSecretEnvelope({
        keyRef: TEST_MMKV_KEY_REF,
      });
    }
  });

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
