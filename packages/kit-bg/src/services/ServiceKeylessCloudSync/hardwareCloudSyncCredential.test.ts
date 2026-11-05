import { createHash, createHmac } from 'crypto';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { payments } from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';

import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';

import {
  deriveHardwareCloudSyncKek,
  getHardwareCloudSyncIdentityTag,
  normalizeHardwareCloudSignature,
  normalizeHardwareCloudWalletXfp,
} from './hardwareCloudSyncCredential';

import type {
  IHardwareCloudKeyAdapter,
  IHardwareCloudKeyIdentity,
} from './hardwareCloudSyncCredential';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
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
const EXPECTED_FAILURE = "Couldn't get the encryption key";

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

  signFailure?: ReturnType<typeof convertDeviceError>;

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
    if (this.signFailure) throw this.signFailure;
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

const TEST_SALT = '00112233445566778899aabbccddeeff';

function derive(
  adapter: MockHardwareCloudKeyAdapter,
  isCurrent = () => true,
  kekSalt = TEST_SALT,
) {
  return deriveHardwareCloudSyncKek({
    adapter,
    expectedIdentity: {
      connectId: 'mock-connect-id',
      deviceId: 'mock-device-id',
      walletXfp: TEST_XFP,
    },
    credentialId: 'hardware-cloud-test',
    isCurrent,
    kekSalt,
  });
}

// RFC 5869 HKDF-SHA256 with a single 32-byte output block.
function hkdfSha256(ikm: Buffer, salt: Buffer, info: string) {
  const prk = createHmac('sha256', salt).update(ikm).digest();
  return createHmac('sha256', prk)
    .update(Buffer.concat([Buffer.from(info, 'utf8'), Buffer.from([1])]))
    .digest('hex');
}

describe('hardware Cloud key credential provider', () => {
  test('signs the salted message twice and derives the KEK with HKDF', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    expect(
      payments.p2pkh({ pubkey: Buffer.from(TEST_PUBLIC_KEY, 'hex') }).address,
    ).toBe(TEST_ADDRESS);
    const message = buildHardwareCloudSyncMessage(
      getHardwareCloudSyncIdentityTag(TEST_XFP),
      TEST_SALT,
    );
    expect(message.length).toBe(199);
    expect(message).toMatch(/^[\x20-\x7e]+$/);
    expect(message).toContain('Signing unlocks ALL your OneKey Cloud data.');
    expect(message.endsWith(`;salt=${TEST_SALT}`)).toBe(true);
    const expectedMaterial = normalizeHardwareCloudSignature(
      bitcoinMessage.sign(message, TEST_PRIVATE_KEY, true).toString('hex'),
    );
    const first = await derive(adapter);
    const second = await derive(new MockHardwareCloudKeyAdapter());
    expect(first).toBe(second);
    expect(adapter.signatures).toBe(2);
    expect(adapter.calls).toHaveLength(2);
    for (const params of adapter.calls) {
      expect(params.path).toBe(HARDWARE_CLOUD_SYNC_PATH);
      expect(params.coin).toBe('Bitcoin');
      expect(params.useEmptyPassphrase).toBe(true);
      expect(Buffer.from(params.messageHex, 'hex').toString('ascii')).toBe(
        message,
      );
    }
    expect(first).toBe(
      hkdfSha256(
        expectedMaterial,
        Buffer.from(TEST_SALT, 'hex'),
        'onekey-hw-cloudsync-kek-v1',
      ),
    );
    expectedMaterial.fill(0);
  });

  test('another salt gives another KEK', async () => {
    const a = await derive(new MockHardwareCloudKeyAdapter());
    const b = await derive(
      new MockHardwareCloudKeyAdapter(),
      () => true,
      'ffeeddccbbaa99887766554433221100',
    );
    expect(a).not.toBe(b);
  });

  test('refuses a malformed salt before asking the device', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    await expect(derive(adapter, () => true, 'NOT-A-SALT')).rejects.toThrow(
      'Invalid Cloud sync key salt',
    );
    expect(adapter.calls).toHaveLength(0);
  });

  test('pads the public root fingerprint without changing xpub case', () => {
    expect(normalizeHardwareCloudWalletXfp(TEST_XFP)).toBe(
      `00001234--xpub${'A'.repeat(107)}`,
    );
    expect(getHardwareCloudSyncIdentityTag(TEST_XFP)).toBe(
      getHardwareCloudSyncIdentityTag(`00001234--xpub${'A'.repeat(107)}`),
    );
  });

  test('hashes the complete normalized wallet identity, including the Taproot xpub', () => {
    expect(getHardwareCloudSyncIdentityTag(TEST_XFP)).toBe(
      createHash('sha256')
        .update(`00001234--xpub${'A'.repeat(107)}`, 'utf8')
        .digest('hex')
        .slice(0, 16),
    );
    expect(getHardwareCloudSyncIdentityTag(TEST_XFP)).not.toBe(
      getHardwareCloudSyncIdentityTag(`00001234--xpub${'B'.repeat(107)}`),
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

  test('preserves the shared hardware error through key derivation', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    const error = convertDeviceError({
      code: HardwareErrorCode.ActionCancelled,
      error: 'Action cancelled',
    });
    adapter.signFailure = error;
    await expect(derive(adapter)).rejects.toBe(error);
  });

  test('preserves hardware errors from a post-sign identity read', async () => {
    const adapter = new MockHardwareCloudKeyAdapter();
    const error = convertDeviceError({
      code: HardwareErrorCode.DeviceNotFound,
      error: 'Device disconnected',
    });
    const readIdentity = jest.spyOn(adapter, 'getIdentity');
    adapter.afterSign = () => readIdentity.mockRejectedValue(error);
    await expect(derive(adapter)).rejects.toBe(error);
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
      'Operation canceled',
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
