import { createHash } from 'crypto';

import { payments } from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';

import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { HardwareCloudKeyDeviceRejectedError } from '@onekeyhq/shared/src/hardware/hardwareCloudKeyDeviceRejectedError';

import {
  deriveHardwareCloudSyncCredential,
  getHardwareCloudSyncIdentityTag,
  normalizeHardwareCloudSignature,
  normalizeHardwareCloudWalletXfp,
} from './hardwareCloudSyncCredential';

import type {
  IHardwareCloudKeyAdapter,
  IHardwareCloudKeyIdentity,
} from './hardwareCloudSyncCredential';

jest.mock('@onekeyhq/shared/src/appCrypto', () => {
  const { createHash: hash } =
    jest.requireActual<typeof import('crypto')>('crypto');
  return {
    __esModule: true,
    default: {
      hash: {
        sha256Sync: (input: Uint8Array) =>
          hash('sha256').update(input).digest(),
        sha512Sync: (input: Uint8Array) =>
          hash('sha512').update(input).digest(),
      },
    },
  };
});

jest.mock('@onekeyhq/core/src/secret', () => ({
  decryptStringAsync: jest.fn(),
}));

jest.mock('../../utils/secretEncryptFormat', () => ({
  EAppCryptoSharedEncryptScene: {},
  encryptStringAsyncWithFormat: jest.fn(),
}));

// Public non-production Bitcoin test key 1. This module is only imported by Jest.
const TEST_PRIVATE_KEY = Buffer.from(`${'00'.repeat(31)}01`, 'hex');
const TEST_PUBLIC_KEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const TEST_ADDRESS = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH';
const TEST_XFP = `1234--xpub${'A'.repeat(107)}`;
const EXPECTED_FAILURE = 'Hardware Cloud key could not be unlocked';

class MockHardwareCloudKeyAdapter implements IHardwareCloudKeyAdapter {
  identity: IHardwareCloudKeyIdentity = {
    connectId: 'mock-connect-id',
    deviceId: 'mock-device-id',
    walletXfp: TEST_XFP,
    publicKey: TEST_PUBLIC_KEY,
    address: TEST_ADDRESS,
    walletType: 'standard',
    unlockedAttachPin: false,
    connected: true,
  };

  signatures = 0;

  calls: Parameters<IHardwareCloudKeyAdapter['signMessage']>[0][] = [];

  signFailure = false;

  firmwareRejection?: string;

  nonDeterministic = false;

  afterSign?: () => void;

  async openStandardWallet() {
    return { ...this.identity };
  }

  async getIdentity() {
    return { ...this.identity };
  }

  async signMessage(
    params: Parameters<IHardwareCloudKeyAdapter['signMessage']>[0],
  ) {
    this.calls.push(params);
    if (this.firmwareRejection) {
      throw new HardwareCloudKeyDeviceRejectedError(
        params.path,
        this.firmwareRejection,
      );
    }
    if (this.signFailure) {
      throw new OneKeyLocalError(
        'SDK cancellation with a deliberately sensitive payload',
      );
    }
    this.signatures += 1;
    const message = Buffer.from(params.messageHex, 'hex').toString('ascii');
    const signature = bitcoinMessage.sign(
      message,
      TEST_PRIVATE_KEY,
      true,
      undefined,
      this.nonDeterministic && this.signatures === 2
        ? { extraEntropy: Buffer.alloc(32, 1) }
        : undefined,
    );
    this.afterSign?.();
    return {
      address: this.identity.address,
      signature: signature.toString('hex'),
    };
  }
}

function derive(adapter: MockHardwareCloudKeyAdapter, isCurrent = () => true) {
  return deriveHardwareCloudSyncCredential({
    adapter,
    expectedIdentity: {
      connectId: 'mock-connect-id',
      deviceId: 'mock-device-id',
      walletXfp: TEST_XFP,
    },
    credentialId: 'hardware-cloud-test',
    isCurrent,
  });
}

describe('hardware Cloud key credential provider', () => {
  test('uses a fixed readable message and deterministic compatible credential', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    expect(
      payments.p2pkh({ pubkey: Buffer.from(TEST_PUBLIC_KEY, 'hex') }).address,
    ).toBe(TEST_ADDRESS);
    const message = buildHardwareCloudSyncMessage(
      getHardwareCloudSyncIdentityTag(TEST_XFP),
    );
    expect(message.length).toBeLessThanOrEqual(150);
    expect(message).toMatch(/^[\x20-\x7e\n]+$/);
    expect(message).toContain('Unlock ALL OneKey Cloud data');
    const expectedMaterial = normalizeHardwareCloudSignature(
      bitcoinMessage.sign(message, TEST_PRIVATE_KEY, true).toString('hex'),
    );
    const first = await derive(adapter);
    const second = await derive(new MockHardwareCloudKeyAdapter());
    expect(first).toEqual(second);
    expect(adapter.signatures).toBe(2);
    expect(adapter.calls).toHaveLength(2);
    for (const params of adapter.calls) {
      expect(params.path).toBe(HARDWARE_CLOUD_SYNC_PATH);
      expect(params.coin).toBe('Bitcoin');
      expect(params.useEmptyPassphrase).toBe(true);
    }
    expect(first.keylessWalletId).toBe('hardware-cloud-test');
    expect(first.signingPrivateKey).toBe(
      createHash('sha256')
        .update(expectedMaterial)
        .update('F7A3E1B2-8C4D-4F6E-9A1B-3D5E7F8A2C4D')
        .digest('hex'),
    );
    expect(first.encryptionKey).toBe(
      createHash('sha256')
        .update(expectedMaterial)
        .update('B2C4D6E8-1A3B-5C7D-9E1F-4A6B8C0D2E4F')
        .digest('hex'),
    );
    expect(first.signingPublicKey).toMatch(/^(02|03)[\da-f]{64}$/);
    expect(first.pwdHash).toMatch(/^keyless-[\da-f]{128}$/);
    expectedMaterial.fill(0);
  });

  test('pads the public root fingerprint without changing xpub case', () => {
    expect(normalizeHardwareCloudWalletXfp(TEST_XFP)).toBe(
      `00001234--xpub${'A'.repeat(107)}`,
    );
    expect(getHardwareCloudSyncIdentityTag(TEST_XFP)).toBe(
      getHardwareCloudSyncIdentityTag(`00001234--xpub${'A'.repeat(107)}`),
    );
  });

  test.each([
    { walletType: 'hidden' as const },
    { passphraseState: 'hidden-session' },
    { unlockedAttachPin: true },
    { connected: false },
    { deviceId: 'replacement-device' },
    { connectId: 'replacement-connection' },
    { walletXfp: `5678--xpub${'A'.repeat(107)}` },
    { address: 'wrong-address' },
    { publicKey: 'invalid-public-key' },
  ])('rejects unsafe identity %j before signing', async (identityPatch) => {
    const adapter = new MockHardwareCloudKeyAdapter();
    Object.assign(adapter.identity, identityPatch);
    await expect(derive(adapter)).rejects.toThrow(EXPECTED_FAILURE);
    expect(adapter.signatures).toBe(0);
  });

  test('keeps a firmware rejection visible instead of the generic error', async () => {
    const rejected = new MockHardwareCloudKeyAdapter();
    rejected.firmwareRejection = 'Failure_DataError,Forbidden key path';
    await expect(derive(rejected)).rejects.toThrow(
      `The device rejected the derivation path ${HARDWARE_CLOUD_SYNC_PATH} (Forbidden key path)`,
    );
  });

  test('rejects cancellation without copying SDK error data', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    adapter.signFailure = true;
    await expect(derive(adapter)).rejects.toThrow(EXPECTED_FAILURE);
    try {
      await derive(adapter);
    } catch (error) {
      expect(String(error)).not.toContain('sensitive payload');
    }
  });

  test('rejects disconnect or a wallet switch after confirmation', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    adapter.afterSign = () => {
      adapter.identity.connected = false;
    };
    await expect(derive(adapter)).rejects.toThrow(EXPECTED_FAILURE);
  });

  test('rejects an operation invalidated while signing', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    let current = true;
    adapter.afterSign = () => {
      current = false;
    };
    await expect(derive(adapter, () => current)).rejects.toThrow(
      EXPECTED_FAILURE,
    );
  });

  test('rejects different valid signatures for the same fixed message', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    adapter.nonDeterministic = true;
    await expect(derive(adapter)).rejects.toThrow(EXPECTED_FAILURE);
    expect(adapter.signatures).toBe(2);
  });

  test('canonicalizes ECDSA high-S with the corresponding recovery parity', () => {
    const message = 'public signature normalization test';
    const low = normalizeHardwareCloudSignature(
      bitcoinMessage.sign(message, TEST_PRIVATE_KEY, true).toString('hex'),
    );
    const high = Buffer.from(low);
    const order =
      0xff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_fe_ba_ae_dc_e6_af_48_a0_3b_bf_d2_5e_8c_d0_36_41_41n;
    const lowS = BigInt(`0x${low.subarray(33).toString('hex')}`);
    const recovery = low[0] - 31;
    high[0] = 31 + (recovery % 2 === 0 ? recovery + 1 : recovery - 1);
    Buffer.from((order - lowS).toString(16).padStart(64, '0'), 'hex').copy(
      high,
      33,
    );
    expect(normalizeHardwareCloudSignature(high.toString('hex'))).toEqual(low);
    expect(bitcoinMessage.verify(message, TEST_ADDRESS, low)).toBe(true);
  });

  test.each(['', '00'.repeat(65), '1b'.padEnd(130, '0'), 'ff'.repeat(65)])(
    'rejects malformed compact signatures',
    (signature) => {
      expect(() => normalizeHardwareCloudSignature(signature)).toThrow();
    },
  );
});
