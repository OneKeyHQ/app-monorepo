import { secp256k1 } from '@noble/curves/secp256k1';
import { EDeviceType } from '@onekeyfe/hd-shared';
import { payments } from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';

import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  HARDWARE_CLOUD_SYNC_AUTH_PATH,
  HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX,
  HARDWARE_CLOUD_SYNC_DERIVATION_VERSION,
  HARDWARE_CLOUD_SYNC_PATH,
  assertHardwareCloudSyncAuthMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHardwareCloudSyncKeySource,
  IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';

import { deriveHardwareCloudSyncKek } from './hardwareCloudSyncCredential';

import type {
  IHardwareCloudKeyAdapter,
  IHardwareCloudKeyIdentity,
  IHardwareCloudKeyUnlock,
} from './hardwareCloudSyncCredential';

// Dev builds only: a fixed test key stands in for the device so end-to-end
// runs need no hardware. It holds no assets and never ships in production.
const SOFTWARE_KEY_SEED = 'onekey-dev-hardware-cloud-sync-software-key-v1';
export const HARDWARE_CLOUD_SYNC_SOFTWARE_CONNECT_ID = 'dev-software-key';

function privateKeyForPath(path: string): Buffer {
  return Buffer.from(
    appCrypto.hash.sha256Sync(
      Buffer.from(`${SOFTWARE_KEY_SEED}:${path}`, 'utf8'),
    ),
  );
}

function signBip137(path: string, message: Buffer): Buffer {
  return bitcoinMessage.sign(message, privateKeyForPath(path), true);
}

export async function generateHardwareCloudSyncCredentialWithSoftwareKey({
  isCurrent,
  unlock,
}: {
  isCurrent: () => boolean;
  unlock: IHardwareCloudKeyUnlock;
}): Promise<{
  credential: IKeylessCloudSyncCredential;
  source: IHardwareCloudSyncKeySource;
}> {
  if (!platformEnv.isDev) {
    throw new OneKeyLocalError('Software Cloud key is only for dev builds');
  }
  const publicKeyBytes = Buffer.from(
    secp256k1.getPublicKey(privateKeyForPath(HARDWARE_CLOUD_SYNC_PATH), true),
  );
  const publicKey = publicKeyBytes.toString('hex');
  const address = payments.p2pkh({ pubkey: publicKeyBytes }).address as string;
  const walletXfp = `00000000--${'z'.repeat(110)}`;
  const credentialId = `${HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX}${Buffer.from(
    appCrypto.hash.sha256Sync(Buffer.from(walletXfp, 'utf8')),
  ).toString('hex')}`;
  const identity: IHardwareCloudKeyIdentity = {
    connectId: HARDWARE_CLOUD_SYNC_SOFTWARE_CONNECT_ID,
    deviceId: HARDWARE_CLOUD_SYNC_SOFTWARE_CONNECT_ID,
    walletXfp,
    publicKey,
    address,
    walletType: 'standard',
    passphraseState: undefined,
    unlockedAttachPin: false,
    connected: true,
  };
  const adapter: IHardwareCloudKeyAdapter = {
    openStandardWallet: async () => identity,
    getIdentity: async () => identity,
    signMessage: async ({ path, messageHex }) => ({
      address,
      signature: signBip137(path, Buffer.from(messageHex, 'hex')).toString(
        'hex',
      ),
    }),
  };
  // Same order as a device: sign in, then the salted key message.
  const credential = await unlock({
    credentialId,
    signAuth: async (message) => {
      assertHardwareCloudSyncAuthMessage(message);
      return signBip137(
        HARDWARE_CLOUD_SYNC_AUTH_PATH,
        Buffer.from(message, 'utf8'),
      ).toString('base64');
    },
    deriveKek: (kekSalt) =>
      deriveHardwareCloudSyncKek({
        credentialId,
        expectedIdentity: identity,
        isCurrent,
        adapter,
        kekSalt,
      }),
  });
  const source: IHardwareCloudSyncKeySource = {
    type: 'hardware',
    credentialId,
    derivationVersion: HARDWARE_CLOUD_SYNC_DERIVATION_VERSION,
    deviceName: 'Dev software key',
    deviceType: EDeviceType.Pro,
  };
  return { credential: { ...credential, source }, source };
}
