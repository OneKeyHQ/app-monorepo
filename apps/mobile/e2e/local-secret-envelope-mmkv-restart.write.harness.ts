import { ethers } from 'ethers';
import { describe, expect, test } from 'react-native-harness';

import { encryptHyperLiquidAgentCredential } from '@onekeyhq/core/src/secret';
import {
  LOCAL_SECRET_ENVELOPE_INNER_PREFIX,
  buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
  deleteMmkvProfileKeyForLocalSecretEnvelope,
  parseLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope';
import { buildSecureStorageLocalSecretEnvelopeLayerAdapter } from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/secureStorageLayerAdapter';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  LSE_MMKV_RESTART_PROFILE_KEY_REF,
  LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF,
  LSE_MMKV_RESTART_USER_ADDRESS,
  getLseMmkvRestartFixture,
  removeLseMmkvRestartFixture,
  setLseMmkvRestartFixture,
} from './local-secret-envelope-mmkv-restart.fixture';

describe('HyperLiquid Agent native LSE restart phase 1', () => {
  test('migrates legacy HLP into a dual-layer LSE before restart', async () => {
    await deleteMmkvProfileKeyForLocalSecretEnvelope({
      keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
    });
    await secureStorageInstance.removeSecureItem(
      LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF,
    );
    await removeLseMmkvRestartFixture();

    try {
      const ephemeralAgentWallet = ethers.Wallet.createRandom();
      const credential = {
        agentAddress: ephemeralAgentWallet.address,
        agentName: EHyperLiquidAgentName.OneKeyAgent1,
        privateKey: ephemeralAgentWallet.privateKey,
        userAddress: LSE_MMKV_RESTART_USER_ADDRESS,
        validUntil: Date.now() + 60_000,
      };
      const recordId = accountUtils.buildHyperLiquidAgentCredentialId({
        agentName: credential.agentName,
        userAddress: credential.userAddress,
      });
      const legacyCredential = encryptHyperLiquidAgentCredential({
        credential,
      });
      const layerAdapters = [
        buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
          keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
        }),
        buildSecureStorageLocalSecretEnvelopeLayerAdapter({
          keyRef: LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF,
        }),
      ];
      const envelope = await wrapLocalSecretEnvelopeV1({
        dataType: 'credential',
        layerAdapters,
        plaintext: legacyCredential,
        recordId,
        strength: 'secure-storage-bound',
      });
      const parsedEnvelope = parseLocalSecretEnvelopeV1(envelope);

      expect(parsedEnvelope.innerPrefix).toBe(
        LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hyperLiquidAgentCredential,
      );
      expect(parsedEnvelope.wrappingLayers.map((layer) => layer.kind)).toEqual([
        'mmkv-profile-key',
        'secure-storage',
      ]);
      expect(parsedEnvelope.strength).toBe('secure-storage-bound');
      expect(envelope).not.toContain(credential.privateKey);

      await setLseMmkvRestartFixture(
        stringUtils.stableStringify({
          agentAddress: credential.agentAddress,
          envelope,
          recordId,
        }),
      );

      expect(await getLseMmkvRestartFixture()).toBeTruthy();
    } catch (error) {
      await deleteMmkvProfileKeyForLocalSecretEnvelope({
        keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
      });
      await secureStorageInstance.removeSecureItem(
        LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF,
      );
      await removeLseMmkvRestartFixture();
      throw error;
    }
  });
});
