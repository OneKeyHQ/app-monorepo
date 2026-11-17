import { ethers } from 'ethers';
import { describe, expect, test } from 'react-native-harness';

import { decryptHyperLiquidAgentCredential } from '@onekeyhq/core/src/secret';
import {
  LOCAL_SECRET_ENVELOPE_INNER_PREFIX,
  buildLocalSecretEnvelopeLayerAdapterResolver,
  buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter,
  deleteMmkvProfileKeyForLocalSecretEnvelope,
  parseLocalSecretEnvelopeV1,
  unwrapLocalSecretEnvelopeV1,
} from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope';
import { buildSecureStorageLocalSecretEnvelopeLayerAdapter } from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/secureStorageLayerAdapter';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

import {
  LSE_MMKV_RESTART_PROFILE_KEY_REF,
  LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF,
  getLseMmkvRestartFixture,
  parseLseMmkvRestartFixture,
  removeLseMmkvRestartFixture,
} from './local-secret-envelope-mmkv-restart.fixture';

describe('HyperLiquid Agent native LSE restart phase 2', () => {
  test('decrypts and signs through both persisted layers after app restart', async () => {
    try {
      const rawFixture = await getLseMmkvRestartFixture();
      if (!rawFixture) {
        throw new OneKeyLocalError(
          'Native HL Agent restart write phase did not persist its fixture',
        );
      }
      const fixture = parseLseMmkvRestartFixture(rawFixture);
      const layerAdapters = [
        buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
          keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
        }),
        buildSecureStorageLocalSecretEnvelopeLayerAdapter({
          keyRef: LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF,
        }),
      ];
      const resolveLayerAdapter =
        buildLocalSecretEnvelopeLayerAdapterResolver(layerAdapters);
      if (!resolveLayerAdapter) {
        throw new OneKeyLocalError(
          'Native HL Agent restart layer resolver is unavailable',
        );
      }
      const parsedEnvelope = parseLocalSecretEnvelopeV1(fixture.envelope);
      expect(parsedEnvelope.innerPrefix).toBe(
        LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hyperLiquidAgentCredential,
      );
      expect(parsedEnvelope.wrappingLayers.map((layer) => layer.kind)).toEqual([
        'mmkv-profile-key',
        'secure-storage',
      ]);
      expect(parsedEnvelope.strength).toBe('secure-storage-bound');

      const innerCredential = await unwrapLocalSecretEnvelopeV1({
        envelope: fixture.envelope,
        expectedDataType: 'credential',
        expectedRecordId: fixture.recordId,
        resolveLayerAdapter,
      });
      const credential = await decryptHyperLiquidAgentCredential({
        credential: innerCredential,
      });
      if (!credential) {
        throw new OneKeyLocalError(
          'Native HL Agent restart credential cannot be decrypted',
        );
      }
      expect(credential.agentAddress).toBe(fixture.agentAddress);

      const domain = {
        chainId: 1,
        name: 'HyperLiquid',
        verifyingContract: ethers.constants.AddressZero,
        version: '1',
      };
      const types = {
        MigrationProof: [{ name: 'nonce', type: 'uint256' }],
      };
      const value = { nonce: 1 };
      const wallet = new ethers.Wallet(credential.privateKey);
      const signature = await wallet._signTypedData(domain, types, value);
      const recoveredAddress = ethers.utils.verifyTypedData(
        domain,
        types,
        value,
        signature,
      );

      expect(recoveredAddress).toBe(
        ethers.utils.getAddress(fixture.agentAddress),
      );
    } finally {
      await deleteMmkvProfileKeyForLocalSecretEnvelope({
        keyRef: LSE_MMKV_RESTART_PROFILE_KEY_REF,
      });
      await secureStorageInstance.removeSecureItem(
        LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF,
      );
      await removeLseMmkvRestartFixture();
    }
  });
});
