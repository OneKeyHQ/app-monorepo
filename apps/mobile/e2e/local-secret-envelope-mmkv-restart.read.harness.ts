import { describe, expect, test } from 'react-native-harness';

import {
  buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
  deleteMmkvProfileKeyForLocalSecretEnvelope,
} from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/mmkvProfileKeyLayerAdapter';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

import {
  LSE_MMKV_RESTART_AAD,
  LSE_MMKV_RESTART_FIXTURE_KEY_REF,
  LSE_MMKV_RESTART_PLAINTEXT,
  LSE_MMKV_RESTART_PROFILE_KEY_REF,
  LSE_MMKV_RESTART_RECORD_ID,
  parseLseMmkvRestartFixture,
} from './local-secret-envelope-mmkv-restart.fixture';

describe('Local Secret Envelope native MMKV restart phase 2', () => {
  test('decrypts with the persisted MMKV key after native app restart', async () => {
    try {
      const rawFixture = await secureStorageInstance.getSecureItem(
        LSE_MMKV_RESTART_FIXTURE_KEY_REF,
      );
      if (!rawFixture) {
        throw new OneKeyLocalError(
          'Native MMKV restart write phase did not persist its fixture',
        );
      }
      const fixture = parseLseMmkvRestartFixture(rawFixture);
      const adapter = buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
        keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
      });
      const plaintext = await adapter.decrypt({
        aad: LSE_MMKV_RESTART_AAD,
        ciphertext: fixture.ciphertext,
        dataType: 'credential',
        layer: fixture.layer,
        layerIndex: 0,
        recordId: LSE_MMKV_RESTART_RECORD_ID,
      });

      expect(plaintext).toBe(LSE_MMKV_RESTART_PLAINTEXT);
    } finally {
      await deleteMmkvProfileKeyForLocalSecretEnvelope({
        keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
      });
      await secureStorageInstance.removeSecureItem(
        LSE_MMKV_RESTART_FIXTURE_KEY_REF,
      );
    }
  });
});
