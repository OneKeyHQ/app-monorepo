import bs58 from 'bs58';

import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

import {
  SignerHardware,
  decodeEd25519Signature,
} from '../signer/impls/sol/SignerHardware';

import type { DeviceInfo } from '../core/auth/auth-types';
import type { ISignerHardwareDeps } from '../signer/base/SignerHardwareBase';
import type { CoreApi } from '@onekeyfe/hd-core';

function makeSuccess<T>(payload: T) {
  return { success: true as const, payload };
}

const DEVICE: DeviceInfo = {
  connectId: 'connect-123',
  deviceId: 'device-abc',
  deviceLabel: 'OneKey Touch',
};

function makeDeps(): {
  deps: ISignerHardwareDeps;
  sdk: jest.Mocked<CoreApi>;
} {
  const sdk = {
    getDeviceState: jest.fn(async () =>
      makeSuccess({ status: { unlocked: true } }),
    ),
    deviceUnlock: jest.fn(async () => makeSuccess({})),
    searchDevices: jest.fn(async () => makeSuccess([DEVICE])),
    solSignOffchainMessage: jest.fn(async () =>
      makeSuccess({ signature: 'aa'.repeat(64) }),
    ),
  } as unknown as jest.Mocked<CoreApi>;
  const deps: ISignerHardwareDeps = {
    ensureSDKReady: jest.fn(
      async () => sdk,
    ) as unknown as ISignerHardwareDeps['ensureSDKReady'],
    installPassphraseProvider: jest.fn(),
    resolvePassphraseSessionByMode:
      jest.fn() as unknown as ISignerHardwareDeps['resolvePassphraseSessionByMode'],
    keychainFactory: () => ({
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    }),
    preloadSessionCache: jest.fn(),
    stderr: { write: jest.fn(() => true) },
  };

  return { deps, sdk };
}

// Ed25519 signatures from the firmware MUST be 64 bytes. A malformed hex
// string would otherwise be silently truncated by Buffer.from(_, 'hex') and
// only surface later as a cryptic web3.js error inside addSignature() or as
// a (potentially regex-passing) bogus txid. These tests pin the fail-closed
// behavior introduced after a review found the original code missing this
// check.
describe('decodeEd25519Signature', () => {
  const valid64ByteHex = 'aa'.repeat(64);

  it('returns a 64-byte Buffer for valid hex', () => {
    const bytes = decodeEd25519Signature(valid64ByteHex, 'signTransaction');
    expect(bytes.length).toBe(64);
    expect(bytes.every((b) => b === 0xaa)).toBe(true);
  });

  it('rejects empty / undefined signatures', () => {
    expect(() => decodeEd25519Signature(undefined, 'signTransaction')).toThrow(
      /empty signature for SOL signTransaction/,
    );
    expect(() => decodeEd25519Signature('', 'signMessage')).toThrow(
      /empty signature for SOL signMessage/,
    );
  });

  it('rejects too-short hex (would otherwise silently produce a short Buffer)', () => {
    expect(() =>
      decodeEd25519Signature('aa'.repeat(32), 'signTransaction'),
    ).toThrow(/32 bytes \(expected 64\)/);
  });

  it('rejects too-long hex', () => {
    expect(() =>
      decodeEd25519Signature('aa'.repeat(65), 'signTransaction'),
    ).toThrow(/65 bytes \(expected 64\)/);
  });

  it('rejects malformed hex (odd length truncated by Buffer.from)', () => {
    // Buffer.from('a', 'hex') silently returns an empty buffer. Make sure
    // the byte-length guard catches this before the signature reaches
    // web3.js or gets base58-encoded as a fake txid.
    expect(() =>
      decodeEd25519Signature('a'.repeat(127), 'signTransaction'),
    ).toThrow(/expected 64/);
  });
});

describe('SOL hardware offchain message signing', () => {
  it('forwards version 1 and byte-sorted required signers to the SDK', async () => {
    const signerA = bs58.encode(Buffer.alloc(32, 0x22));
    const signerB = bs58.encode(Buffer.alloc(32, 0x11));
    const { deps, sdk } = makeDeps();
    const signer = new SignerHardware({
      device: { ...DEVICE },
      passphraseMode: 'none',
      deps,
    });

    const signature = await signer.signMessage({
      account: {
        address: signerA,
        path: "m/44'/501'/0'/0'",
      },
      unsignedMsg: {
        type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
        message: 'hello',
        payload: {
          version: 1,
          requiredSigners: [signerA, signerB],
        },
      },
    } as never);

    expect(signature).toBe(bs58.encode(Buffer.alloc(64, 0xaa)));
    expect(sdk.solSignOffchainMessage).toHaveBeenCalledWith(
      DEVICE.connectId,
      DEVICE.deviceId,
      {
        path: "m/44'/501'/0'/0'",
        messageHex: Buffer.from('hello').toString('hex'),
        messageVersion: 1,
        requiredSigners: [
          Buffer.alloc(32, 0x11).toString('hex'),
          Buffer.alloc(32, 0x22).toString('hex'),
        ],
        useEmptyPassphrase: true,
        skipPassphraseCheck: true,
      },
    );
  });

  it('rejects version 1 when the signing account is not required', async () => {
    const account = bs58.encode(Buffer.alloc(32, 0x22));
    const otherSigner = bs58.encode(Buffer.alloc(32, 0x11));
    const { deps, sdk } = makeDeps();
    const signer = new SignerHardware({
      device: { ...DEVICE },
      passphraseMode: 'none',
      deps,
    });

    await expect(
      signer.signMessage({
        account: {
          address: account,
          path: "m/44'/501'/0'/0'",
        },
        unsignedMsg: {
          type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
          message: 'hello',
          payload: { version: 1, requiredSigners: [otherSigner] },
        },
      } as never),
    ).rejects.toThrow('requiredSigners must include the signing account');
    expect(sdk.solSignOffchainMessage).not.toHaveBeenCalled();
  });

  it('rejects version 0 without calling the hardware SDK', async () => {
    const account = bs58.encode(Buffer.alloc(32, 0x22));
    const { deps, sdk } = makeDeps();
    const signer = new SignerHardware({
      device: { ...DEVICE },
      passphraseMode: 'none',
      deps,
    });

    await expect(
      signer.signMessage({
        account: {
          address: account,
          path: "m/44'/501'/0'/0'",
        },
        unsignedMsg: {
          type: EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE,
          message: 'hello',
          payload: { version: 0 },
        },
      } as never),
    ).rejects.toThrow(
      'Version 0 Solana offchain messages are not supported by hardware wallets',
    );
    expect(sdk.solSignOffchainMessage).not.toHaveBeenCalled();
  });
});
