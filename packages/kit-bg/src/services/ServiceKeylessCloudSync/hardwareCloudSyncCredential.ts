import { payments } from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';

import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { normalizeFullWalletXfp } from '@onekeyhq/shared/src/utils/walletXfpUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';

import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

export type IHardwareCloudKeyIdentity = {
  connectId: string;
  deviceId: string;
  walletXfp: string;
  publicKey: string;
  address: string;
  walletType: 'standard' | 'hidden';
  passphraseState?: string | null;
  unlockedAttachPin: boolean;
  connected: boolean;
};

export type IHardwareCloudKeyAdapter = {
  openStandardWallet(): Promise<IHardwareCloudKeyIdentity>;
  getIdentity(): Promise<IHardwareCloudKeyIdentity>;
  signMessage(params: {
    path: string;
    messageHex: string;
    coin: 'Bitcoin';
    useEmptyPassphrase: true;
  }): Promise<{ address: string; signature: string }>;
};

type IExpectedIdentity = Pick<
  IHardwareCloudKeyIdentity,
  'connectId' | 'deviceId' | 'walletXfp'
>;

const SECP256K1_ORDER =
  0xff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_fe_ba_ae_dc_e6_af_48_a0_3b_bf_d2_5e_8c_d0_36_41_41n;

function identityError(): OneKeyLocalError {
  return new OneKeyLocalError('Hardware Cloud key identity changed');
}

export function normalizeHardwareCloudWalletXfp(walletXfp: string): string {
  try {
    return normalizeFullWalletXfp(walletXfp);
  } catch {
    throw identityError();
  }
}

export function getHardwareCloudSyncIdentityTag(walletXfp: string): string {
  return Buffer.from(
    appCrypto.hash.sha256Sync(
      Buffer.from(normalizeHardwareCloudWalletXfp(walletXfp), 'utf8'),
    ),
  )
    .toString('hex')
    .slice(0, 16);
}

function assertIdentity(
  identity: IHardwareCloudKeyIdentity,
  expected: IExpectedIdentity,
  standard?: IHardwareCloudKeyIdentity,
): void {
  if (
    !identity.connected ||
    identity.walletType !== 'standard' ||
    identity.unlockedAttachPin !== false ||
    !!identity.passphraseState ||
    !identity.connectId ||
    !identity.deviceId ||
    identity.connectId !== expected.connectId ||
    identity.deviceId !== expected.deviceId ||
    normalizeHardwareCloudWalletXfp(identity.walletXfp) !==
      normalizeHardwareCloudWalletXfp(expected.walletXfp) ||
    !/^(02|03)[\da-f]{64}$/i.test(identity.publicKey)
  ) {
    throw identityError();
  }
  if (
    standard &&
    (identity.publicKey.toLowerCase() !== standard.publicKey.toLowerCase() ||
      identity.address !== standard.address)
  ) {
    throw identityError();
  }
  const address = payments.p2pkh({
    pubkey: Buffer.from(identity.publicKey, 'hex'),
  }).address;
  if (!address || identity.address !== address) {
    throw identityError();
  }
}

// V1 material is compressed P2PKH compact65: header || r32 || lowS32. Normalize
// the recovery parity when changing S so equivalent ECDSA encodings agree.
export function normalizeHardwareCloudSignature(signatureHex: string): Buffer {
  if (!/^[\da-f]{130}$/i.test(signatureHex)) {
    throw new OneKeyLocalError('Invalid Hardware Cloud key signature');
  }
  const signature = Buffer.from(signatureHex, 'hex');
  const r = BigInt(`0x${signature.subarray(1, 33).toString('hex')}`);
  const s = BigInt(`0x${signature.subarray(33, 65).toString('hex')}`);
  if (
    signature[0] < 31 ||
    signature[0] > 34 ||
    r <= 0n ||
    r >= SECP256K1_ORDER ||
    s <= 0n ||
    s >= SECP256K1_ORDER
  ) {
    signature.fill(0);
    throw new OneKeyLocalError('Invalid Hardware Cloud key signature');
  }
  if (s > SECP256K1_ORDER / 2n) {
    const recovery = signature[0] - 31;
    signature[0] = 31 + (recovery % 2 === 0 ? recovery + 1 : recovery - 1);
    Buffer.from(
      (SECP256K1_ORDER - s).toString(16).padStart(64, '0'),
      'hex',
    ).copy(signature, 33);
  }
  return signature;
}

export async function deriveHardwareCloudSyncCredential({
  adapter,
  expectedIdentity,
  credentialId,
  isCurrent,
}: {
  adapter: IHardwareCloudKeyAdapter;
  expectedIdentity: IExpectedIdentity;
  credentialId: string;
  isCurrent: () => boolean;
}): Promise<IKeylessCloudSyncCredential> {
  const expected = Object.freeze({ ...expectedIdentity });
  let first: Buffer | undefined;
  let second: Buffer | undefined;
  const assertCurrent = () => {
    if (!isCurrent() || !credentialId) {
      throw new OneKeyLocalError('Hardware Cloud key operation expired');
    }
  };
  try {
    assertCurrent();
    const opened = await adapter.openStandardWallet();
    assertCurrent();
    const standard = Object.freeze({ ...opened });
    assertIdentity(standard, expected);
    const message = buildHardwareCloudSyncMessage(
      getHardwareCloudSyncIdentityTag(standard.walletXfp),
    );
    const checkCurrentIdentity = async () => {
      assertCurrent();
      const identity = await adapter.getIdentity();
      assertCurrent();
      assertIdentity(identity, expected, standard);
    };
    const sign = async () => {
      await checkCurrentIdentity();
      const response = await adapter.signMessage({
        path: HARDWARE_CLOUD_SYNC_PATH,
        messageHex: Buffer.from(message, 'ascii').toString('hex'),
        coin: 'Bitcoin',
        useEmptyPassphrase: true,
      });
      assertCurrent();
      const normalized = normalizeHardwareCloudSignature(response.signature);
      try {
        if (
          response.address !== standard.address ||
          !bitcoinMessage.verify(message, standard.address, normalized)
        ) {
          throw identityError();
        }
        await checkCurrentIdentity();
        return normalized;
      } catch {
        normalized.fill(0);
        throw identityError();
      }
    };
    first = await sign();
    second = await sign();
    if (!first.equals(second)) {
      throw new OneKeyLocalError('Hardware Cloud key signature is not stable');
    }
    assertCurrent();
    const credential = await keylessCloudSyncUtils.deriveKeylessCredential({
      seed: first,
      keylessWalletId: credentialId,
    });
    assertCurrent();
    return credential;
  } catch {
    // SDK errors may carry request/response objects. Do not propagate them into
    // ordinary RPC error logging, analytics, or the message-signing UI.
    throw new OneKeyLocalError(
      'Hardware Cloud key could not be unlocked. Check the standard wallet and try again.',
    );
  } finally {
    first?.fill(0);
    second?.fill(0);
  }
}
