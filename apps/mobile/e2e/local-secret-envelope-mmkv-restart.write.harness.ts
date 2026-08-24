import { describe, expect, test } from 'react-native-harness';

import {
  buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
  deleteMmkvProfileKeyForLocalSecretEnvelope,
} from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/mmkvProfileKeyLayerAdapter';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  LSE_MMKV_RESTART_AAD,
  LSE_MMKV_RESTART_FIXTURE_KEY_REF,
  LSE_MMKV_RESTART_PLAINTEXT,
  LSE_MMKV_RESTART_PROFILE_KEY_REF,
  LSE_MMKV_RESTART_RECORD_ID,
} from './local-secret-envelope-mmkv-restart.fixture';

describe('Local Secret Envelope native MMKV restart phase 1', () => {
  test('persists an MMKV-backed ciphertext fixture before restart', async () => {
    await deleteMmkvProfileKeyForLocalSecretEnvelope({
      keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
    });
    await secureStorageInstance.removeSecureItem(
      LSE_MMKV_RESTART_FIXTURE_KEY_REF,
    );

    try {
      const adapter = buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
        keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
      });
      const params = {
        dataType: 'credential' as const,
        layerIndex: 0,
        recordId: LSE_MMKV_RESTART_RECORD_ID,
      };
      const layer = await adapter.prepareLayer(params);
      const ciphertext = await adapter.encrypt({
        ...params,
        aad: LSE_MMKV_RESTART_AAD,
        layer,
        plaintext: LSE_MMKV_RESTART_PLAINTEXT,
      });
      await secureStorageInstance.setSecureItem(
        LSE_MMKV_RESTART_FIXTURE_KEY_REF,
        stringUtils.stableStringify({ ciphertext, layer }),
      );

      expect(
        await secureStorageInstance.getSecureItem(
          LSE_MMKV_RESTART_FIXTURE_KEY_REF,
        ),
      ).toBeTruthy();
    } catch (error) {
      await deleteMmkvProfileKeyForLocalSecretEnvelope({
        keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
      });
      await secureStorageInstance.removeSecureItem(
        LSE_MMKV_RESTART_FIXTURE_KEY_REF,
      );
      throw error;
    }
  });
});
