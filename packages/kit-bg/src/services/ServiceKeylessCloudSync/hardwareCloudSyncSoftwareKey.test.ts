import { createHash } from 'crypto';

import { secp256k1 } from '@noble/curves/secp256k1';
import { payments } from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';

import {
  HARDWARE_CLOUD_SYNC_AUTH_PATH,
  buildHardwareCloudSyncAuthMessage,
  getHardwareCloudSyncIdentityTagFromCredentialId,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { generateHardwareCloudSyncCredentialWithSoftwareKey } from './hardwareCloudSyncSoftwareKey';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: true },
}));
jest.mock('@onekeyhq/shared/src/appCrypto', () => {
  const { createHash: hash } =
    jest.requireActual<typeof import('crypto')>('crypto');
  return {
    __esModule: true,
    default: {
      hash: {
        sha256Sync: (input: Uint8Array) =>
          hash('sha256').update(input).digest(),
      },
    },
  };
});
jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: {
    getEstimatedServerTime: () => Date.parse('2030-01-01T00:00:00.000Z'),
  },
}));
jest.mock('@onekeyhq/core/src/secret', () => ({
  decryptStringAsync: jest.fn(),
}));
jest.mock('../../utils/secretEncryptFormat', () => ({
  EAppCryptoSharedEncryptScene: {},
  encryptStringAsyncWithFormat: jest.fn(),
}));

const credential = {
  keylessWalletId: 'public-test-wallet',
  signingPrivateKey: '',
  signingPublicKey: '',
  encryptionKey: 'public-test-placeholder',
  pwdHash: 'public-test-placeholder',
};

test('the dev software signer signs the exact final challenge on the auth path', async () => {
  let current = true;
  await generateHardwareCloudSyncCredentialWithSoftwareKey({
    isCurrent: () => current,
    unlock: async (device) => {
      const context = {
        identityTag: getHardwareCloudSyncIdentityTagFromCredentialId(
          device.credentialId,
        ),
        env: 'test' as const,
        jkt: '0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I',
      };
      const message = buildHardwareCloudSyncAuthMessage({
        ...context,
        nonce: 'ab'.repeat(32),
        expires: '2030-01-01T00:05:00.000Z',
      });
      const signature = await device.signAuth(message, context);
      // Public development fixture: verification is independent of the signer.
      const publicKey = secp256k1.getPublicKey(
        createHash('sha256')
          .update(
            `onekey-dev-hardware-cloud-sync-software-key-v1:${HARDWARE_CLOUD_SYNC_AUTH_PATH}`,
          )
          .digest(),
        true,
      );
      const { address } = payments.p2pkh({ pubkey: Buffer.from(publicKey) });
      if (!address) throw new OneKeyLocalError('Missing fixture address');
      expect(bitcoinMessage.verify(message, address, signature)).toBe(true);
      await expect(
        device.signAuth(message, { ...context, env: 'prod' }),
      ).rejects.toThrow();
      await expect(
        device.signAuth(message, {
          ...context,
          identityTag: 'fedcba9876543210',
        }),
      ).rejects.toThrow();
      await expect(
        device.signAuth('OneKey Cloud Sync sign-in\nNonce: abc', context),
      ).rejects.toThrow();
      current = false;
      await expect(device.signAuth(message, context)).rejects.toThrow(
        'operation expired',
      );
      return credential;
    },
  });
});

test('software profiles restore the same key without sharing the default test identity', async () => {
  const read = async (profile?: string) => {
    let result: { credentialId: string; kek: string } | undefined;
    await generateHardwareCloudSyncCredentialWithSoftwareKey({
      profile,
      isCurrent: () => true,
      unlock: async (device) => {
        result = {
          credentialId: device.credentialId,
          kek: await device.deriveKek('ab'.repeat(16)),
        };
        return credential;
      },
    });
    if (!result) throw new OneKeyLocalError('Missing software test identity');
    return result;
  };
  const first = await read('desktop-profile-a');
  expect(await read('desktop-profile-a')).toEqual(first);
  const other = await read('desktop-profile-b');
  const original = await read();
  expect(other.credentialId).not.toBe(first.credentialId);
  expect(other.kek).not.toBe(first.kek);
  expect(original.credentialId).not.toBe(first.credentialId);
  expect(original.kek).not.toBe(first.kek);
});

test('a software profile cannot enable the signer outside development builds', async () => {
  const restore = jest.replaceProperty(platformEnv, 'isDev', false);
  const unlock = jest.fn(async () => credential);
  try {
    await expect(
      generateHardwareCloudSyncCredentialWithSoftwareKey({
        profile: 'desktop-profile-a',
        isCurrent: () => true,
        unlock,
      }),
    ).rejects.toThrow('only for dev builds');
    expect(unlock).not.toHaveBeenCalled();
  } finally {
    restore.restore();
  }
});
