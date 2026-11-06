import { createHash } from 'crypto';

import { secp256k1 } from '@onekeyhq/core/src/secret/curves';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import keylessCloudSyncUtils from './keylessCloudSyncUtils';

describe('shared Cloud credential protocol compatibility', () => {
  test('preserves the existing Keyless seed derivation', async () => {
    // Public synthetic seed bytes, never a user wallet or persistent credential.
    const seed = Buffer.alloc(64);
    const credential = await keylessCloudSyncUtils.deriveKeylessCredential({
      seed,
      keylessWalletId: 'public-keyless-fixture',
    });
    expect(credential.signingPrivateKey).toBe(
      createHash('sha256')
        .update(seed)
        .update('F7A3E1B2-8C4D-4F6E-9A1B-3D5E7F8A2C4D')
        .digest('hex'),
    );
    expect(credential.encryptionKey).toBe(
      createHash('sha256')
        .update(seed)
        .update('B2C4D6E8-1A3B-5C7D-9E1F-4A6B8C0D2E4F')
        .digest('hex'),
    );
  });

  test('a signature-material credential uses the existing request nonce and body binding', async () => {
    const credential = await keylessCloudSyncUtils.deriveKeylessCredential({
      seed: Buffer.alloc(65, 17),
      keylessWalletId: 'public-hardware-fixture',
    });
    const body = { localData: [], nonce: 0, pwdHash: credential.pwdHash };
    const dataHash = keylessCloudSyncUtils.computeDataHash(
      stringUtils.stableStringify(body),
    );
    const timestamp = 1_750_000_000_000;
    const build = () =>
      keylessCloudSyncUtils.buildKeylessSignatureHeader({
        signingPrivateKey: credential.signingPrivateKey,
        signingPublicKey: credential.signingPublicKey,
        dataHash,
        timestamp,
      });
    const first = checkIsDefined(
      keylessCloudSyncUtils.parseSignatureHeader(build()) ?? undefined,
    );
    const second = checkIsDefined(
      keylessCloudSyncUtils.parseSignatureHeader(build()) ?? undefined,
    );
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(second.nonce).not.toBe(first.nonce);
    expect(first.publicKey).toBe(credential.signingPublicKey);
    const digest = appCrypto.hash.sha256Sync(
      Buffer.from(
        stringUtils.stableStringify({
          timestamp: first.timestamp,
          nonce: first.nonce,
          dataHash,
        }),
        'utf8',
      ),
    );
    expect(
      secp256k1.verify(
        Buffer.from(first.publicKey, 'hex'),
        Buffer.from(digest),
        Buffer.from(first.signature, 'hex'),
      ),
    ).toBe(true);
    const changed = appCrypto.hash.sha256Sync(
      Buffer.from(
        stringUtils.stableStringify({
          timestamp: first.timestamp,
          nonce: first.nonce,
          dataHash: keylessCloudSyncUtils.computeDataHash('tampered body'),
        }),
        'utf8',
      ),
    );
    expect(
      secp256k1.verify(
        Buffer.from(first.publicKey, 'hex'),
        Buffer.from(changed),
        Buffer.from(first.signature, 'hex'),
      ),
    ).toBe(false);
  });

  test('the same credential survives restart and shares AES-GCM item/AAD validation', async () => {
    const material = Buffer.alloc(65, 23);
    const first = await keylessCloudSyncUtils.deriveKeylessCredential({
      seed: material,
      keylessWalletId: 'public-hardware-fixture',
    });
    const restored = await keylessCloudSyncUtils.deriveKeylessCredential({
      seed: material,
      keylessWalletId: 'different-local-device-id',
    });
    expect(restored.encryptionKey).toBe(first.encryptionKey);
    expect(restored.signingPublicKey).toBe(first.signingPublicKey);
    const itemId = 'public-test-item';
    const dataType = 'Wallet';
    const rawData = stringUtils.stableStringify({
      name: 'Public test metadata',
    });
    const encryptedData = await keylessCloudSyncUtils.encryptWithKeylessKey({
      rawData,
      encryptionKey: first.encryptionKey,
      itemId,
      dataType,
    });
    expect(
      await keylessCloudSyncUtils.decryptWithKeylessKey({
        encryptedData,
        encryptionKey: restored.encryptionKey,
        itemId,
        dataType,
      }),
    ).toBe(rawData);
    await expect(
      keylessCloudSyncUtils.decryptWithKeylessKey({
        encryptedData,
        encryptionKey: restored.encryptionKey,
        itemId: 'wrong-item',
        dataType,
      }),
    ).rejects.toThrow();
    await expect(
      keylessCloudSyncUtils.decryptWithKeylessKey({
        encryptedData,
        encryptionKey: '00'.repeat(32),
        itemId,
        dataType,
      }),
    ).rejects.toThrow();
  });
});
