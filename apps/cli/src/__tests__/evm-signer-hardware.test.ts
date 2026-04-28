/**
 * Unit tests for the EVM `SignerHardware` — injects a mock SDK + keychain +
 * hd-core preloader so we can exercise the full dispatch matrix without
 * real USB hardware.
 *
 * Covers:
 *   - passphrase mode 'none' → useEmptyPassphrase branch, no keychain reads
 *   - passphrase mode 'on_host' → keychain preload hits session cache
 *   - passphrase mode 'on_host' with deviceWasLocked → keychain skipped,
 *     resolvePassphraseStateByMode fallback, result re-persisted
 *   - buildHardwareEvmTransaction + buildSignedTxFromSignatureEvm wired in
 *     for both EIP-1559 and legacy shapes
 *   - signMessage throws when path missing
 */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SignerHardware } from '../signer/impls/evm/SignerHardware';
import {
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
  persistKeychainSessionPair,
} from '../signer/keychain-keys';

import type { DeviceInfo } from '../core/auth/auth-types';
import type { ISignerHardwareDeps } from '../signer/base/SignerHardwareBase';
import type { CoreApi } from '@onekeyfe/hd-core';

// jest.mock is hoisted by babel-jest, so it runs before the imports at
// runtime. Keeping it below the import block lets oxlint's type-aware
// inference resolve the classes instead of collapsing them to `any`.
jest.mock('@onekeyhq/core/src/secret', () => ({
  revealableSeedFromMnemonic: jest.fn(),
}));

function makeSuccess<T>(payload: T) {
  return { success: true as const, payload };
}

// The SDK's passphraseState / session_id are opaque tokens — in practice
// base58-ish ASCII strings like "mpdLW1n5…", not hex. Tests use the same
// shape to catch regressions of the original "expected hex" assumption.
const MOCK_PS_FROM_KEYCHAIN = 'mpdLW1n5Xr6kQ2AgE9';
const MOCK_SID_FROM_KEYCHAIN = 'sess_N1fKj3BvP4kRZ';
const MOCK_STALE_PS = 'stalePsXyz7HkLm9';
const MOCK_STALE_SID = 'staleSidAbc4JkRp';
const MOCK_RESOLVED_PS = 'freshResolveWxYz23';
// Returned by sdk.searchDevices() after a fresh getPassphraseState — this
// is the session_id that persistPassphraseState must capture and write to
// the keychain to replace the now-invalid stale one.
const MOCK_FRESH_SID_AFTER_RESOLVE = 'sess_freshAfterUnlockK7';

const DEVICE: DeviceInfo = {
  connectId: 'connect-123',
  deviceId: 'device-abc',
  deviceLabel: 'OneKey Touch',
};

function makeDeps(
  overrides: {
    sdk?: Partial<CoreApi>;
    keychainEntries?: Record<string, Buffer>;
    unlocked?: boolean;
    resolveByMode?: jest.Mock;
    preloadSessionCache?: jest.Mock;
  } = {},
): {
  deps: ISignerHardwareDeps;
  mocks: {
    sdk: jest.Mocked<CoreApi>;
    keychainGet: jest.Mock;
    keychainSet: jest.Mock;
    installPassphraseProvider: jest.Mock;
    resolvePassphraseStateByMode: jest.Mock;
    preloadSessionCache: jest.Mock;
    stderrWrite: jest.Mock;
  };
} {
  const keychainStore: Record<string, Buffer> = {
    ...overrides.keychainEntries,
  };
  const keychainGet = jest.fn(async (key: string) =>
    keychainStore[key] ? Buffer.from(keychainStore[key]) : null,
  );
  const keychainSet = jest.fn(async (key: string, value: Buffer) => {
    keychainStore[key] = Buffer.from(value);
  });
  const keychainDelete = jest.fn(async (key: string) => {
    delete keychainStore[key];
  });

  const sdk = {
    getFeatures: jest.fn(async () =>
      makeSuccess({ unlocked: overrides.unlocked ?? true }),
    ),
    deviceUnlock: jest.fn(async () => makeSuccess({})),
    // searchDevices is invoked by persistPassphraseState to discover the
    // session_id the device just minted for the freshly-resolved passphrase.
    searchDevices: jest.fn(async () =>
      makeSuccess([
        {
          connectId: DEVICE.connectId,
          deviceId: DEVICE.deviceId,
          features: {
            device_id: DEVICE.deviceId,
            session_id: MOCK_FRESH_SID_AFTER_RESOLVE,
          },
        },
      ]),
    ),
    evmGetAddress: jest.fn(async () =>
      makeSuccess({ address: '0xabc', path: "m/44'/60'/0'/0/0" }),
    ),
    evmSignTransaction: jest.fn(async () =>
      makeSuccess({ v: 27, r: '0x01', s: '0x02' }),
    ),
    evmSignMessage: jest.fn(async () =>
      makeSuccess({ signature: '0xdeadbeef' }),
    ),
    ...overrides.sdk,
  } as unknown as jest.Mocked<CoreApi>;

  const ensureSDKReady = jest.fn(async () => sdk);
  const installPassphraseProvider = jest.fn();
  // passphraseState from the SDK is an opaque ASCII token (base58-ish,
  // not hex). The default here matches the real-world shape so the
  // keychain utf-8 round-trip stays honest under test.
  const resolvePassphraseStateByMode =
    overrides.resolveByMode ?? jest.fn(async () => MOCK_RESOLVED_PS);
  const preloadSessionCache = overrides.preloadSessionCache ?? jest.fn();
  const stderrWrite = jest.fn(() => true);

  const deps: ISignerHardwareDeps = {
    ensureSDKReady:
      ensureSDKReady as unknown as ISignerHardwareDeps['ensureSDKReady'],
    installPassphraseProvider,
    resolvePassphraseStateByMode:
      resolvePassphraseStateByMode as unknown as ISignerHardwareDeps['resolvePassphraseStateByMode'],
    keychainFactory: () => ({
      get: keychainGet,
      set: keychainSet,
      delete: keychainDelete,
    }),
    preloadSessionCache,
    stderr: { write: stderrWrite },
  };

  return {
    deps,
    mocks: {
      sdk,
      keychainGet,
      keychainSet,
      installPassphraseProvider,
      resolvePassphraseStateByMode,
      preloadSessionCache,
      stderrWrite,
    },
  };
}

describe('SignerHardware', () => {
  describe('persistKeychainSessionPair', () => {
    it('clears both keys when session_id write fails', async () => {
      const calls: Array<{ op: 'set' | 'delete'; key: string }> = [];
      const keychain = {
        set: jest.fn(async (key: string) => {
          calls.push({ op: 'set', key });
          if (key === KEYCHAIN_SESSION_ID_KEY) {
            throw new OneKeyLocalError('session_id write failed');
          }
        }),
        delete: jest.fn(async (key: string) => {
          calls.push({ op: 'delete', key });
        }),
      };

      await expect(
        persistKeychainSessionPair(
          keychain,
          MOCK_RESOLVED_PS,
          MOCK_SID_FROM_KEYCHAIN,
        ),
      ).rejects.toThrow('session_id write failed');

      expect(calls).toEqual([
        { op: 'set', key: KEYCHAIN_PASSPHRASE_STATE_KEY },
        { op: 'set', key: KEYCHAIN_SESSION_ID_KEY },
        { op: 'delete', key: KEYCHAIN_PASSPHRASE_STATE_KEY },
        { op: 'delete', key: KEYCHAIN_SESSION_ID_KEY },
      ]);
    });

    it('clears both keys when passphraseState write fails', async () => {
      const keychain = {
        set: jest.fn(async (key: string) => {
          if (key === KEYCHAIN_PASSPHRASE_STATE_KEY) {
            throw new OneKeyLocalError('passphraseState write failed');
          }
        }),
        delete: jest.fn(async () => undefined),
      };

      await expect(
        persistKeychainSessionPair(
          keychain,
          MOCK_RESOLVED_PS,
          MOCK_SID_FROM_KEYCHAIN,
        ),
      ).rejects.toThrow('passphraseState write failed');

      expect(keychain.delete).toHaveBeenCalledWith(
        KEYCHAIN_PASSPHRASE_STATE_KEY,
      );
      expect(keychain.delete).toHaveBeenCalledWith(KEYCHAIN_SESSION_ID_KEY);
    });
  });

  describe('passphraseMode = none', () => {
    it('uses useEmptyPassphrase, never reads keychain', async () => {
      const { deps, mocks } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      const addr = await signer.getAddress('evm--1');

      expect(addr).toEqual({ address: '0xabc', path: "m/44'/60'/0'/0/0" });
      expect(mocks.keychainGet).not.toHaveBeenCalled();
      expect(mocks.resolvePassphraseStateByMode).not.toHaveBeenCalled();
      expect(mocks.preloadSessionCache).not.toHaveBeenCalled();

      const callArgs = mocks.sdk.evmGetAddress.mock.calls[0];
      expect(callArgs[2]).toMatchObject({
        useEmptyPassphrase: true,
        skipPassphraseCheck: true,
      });
      expect(callArgs[2]).not.toHaveProperty('passphraseState');
    });

    it('installs a passphrase provider anyway (for fallback handling)', async () => {
      const { deps, mocks } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });
      expect(signer).toBeInstanceOf(SignerHardware);
      expect(mocks.installPassphraseProvider).toHaveBeenCalledWith('none');
    });
  });

  describe('passphraseMode = on_host with warm keychain', () => {
    it('preloads session cache and reuses passphraseState from keychain', async () => {
      const { deps, mocks } = makeDeps({
        keychainEntries: {
          [KEYCHAIN_PASSPHRASE_STATE_KEY]: Buffer.from(
            MOCK_PS_FROM_KEYCHAIN,
            'utf-8',
          ),
          [KEYCHAIN_SESSION_ID_KEY]: Buffer.from(
            MOCK_SID_FROM_KEYCHAIN,
            'utf-8',
          ),
        },
      });

      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'on_host',
        deps,
      });

      await signer.getAddress('evm--1');

      expect(mocks.preloadSessionCache).toHaveBeenCalledWith(
        DEVICE.deviceId,
        MOCK_PS_FROM_KEYCHAIN,
        MOCK_SID_FROM_KEYCHAIN,
      );
      expect(mocks.resolvePassphraseStateByMode).not.toHaveBeenCalled();
      const params = mocks.sdk.evmGetAddress.mock.calls[0][2];
      expect(params).toMatchObject({
        passphraseState: MOCK_PS_FROM_KEYCHAIN,
        skipPassphraseCheck: true,
      });
      expect(params).not.toHaveProperty('useEmptyPassphrase');
    });
  });

  describe('passphraseMode = on_host with locked device', () => {
    it('unlocks device, skips stale keychain session, resolves fresh, re-persists BOTH keys', async () => {
      const { deps, mocks } = makeDeps({
        unlocked: false,
        keychainEntries: {
          [KEYCHAIN_PASSPHRASE_STATE_KEY]: Buffer.from(MOCK_STALE_PS, 'utf-8'),
          [KEYCHAIN_SESSION_ID_KEY]: Buffer.from(MOCK_STALE_SID, 'utf-8'),
        },
      });

      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'on_host',
        deps,
      });

      await signer.getAddress('evm--1');

      expect(mocks.sdk.deviceUnlock).toHaveBeenCalledWith(DEVICE.connectId, {});
      expect(mocks.resolvePassphraseStateByMode).toHaveBeenCalledWith(
        DEVICE.connectId,
        'on_host',
      );

      // Regression guard for the post-lock pinentry-loop bug:
      // persistPassphraseState MUST refresh BOTH keychain keys, otherwise
      // the next process reads (NEW passphraseState, OLD session_id), feeds
      // that combo to the SDK, and the device rejects → pinentry pops on
      // every command after a lock/unlock cycle.
      expect(mocks.keychainSet).toHaveBeenCalledWith(
        KEYCHAIN_PASSPHRASE_STATE_KEY,
        Buffer.from(MOCK_RESOLVED_PS, 'utf-8'),
      );
      expect(mocks.keychainSet).toHaveBeenCalledWith(
        KEYCHAIN_SESSION_ID_KEY,
        Buffer.from(MOCK_FRESH_SID_AFTER_RESOLVE, 'utf-8'),
      );

      // searchDevices is the source of the fresh session_id post-resolve.
      expect(mocks.sdk.searchDevices).toHaveBeenCalled();

      // After persisting, warm the SDK in-process cache with the new
      // (deviceId, freshPassphraseState, freshSessionId) triple so any
      // subsequent call this run hits the cache too.
      expect(mocks.preloadSessionCache).toHaveBeenCalledWith(
        DEVICE.deviceId,
        MOCK_RESOLVED_PS,
        MOCK_FRESH_SID_AFTER_RESOLVE,
      );

      expect(mocks.sdk.evmGetAddress.mock.calls[0][2]).toMatchObject({
        passphraseState: MOCK_RESOLVED_PS,
        skipPassphraseCheck: true,
      });
    });
  });

  describe('passphraseMode = on_host with empty keychain + unlocked device', () => {
    it('resolves fresh passphraseState via SDK and persists BOTH keys to keychain', async () => {
      const { deps, mocks } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'on_host',
        deps,
      });

      await signer.getAddress('evm--1');

      expect(mocks.resolvePassphraseStateByMode).toHaveBeenCalledWith(
        DEVICE.connectId,
        'on_host',
      );
      // Both keys must be written so the next process can preload a valid
      // (passphraseState, session_id) pair without re-prompting pinentry.
      expect(mocks.keychainSet).toHaveBeenCalledWith(
        KEYCHAIN_SESSION_ID_KEY,
        Buffer.from(MOCK_FRESH_SID_AFTER_RESOLVE, 'utf-8'),
      );
      expect(mocks.keychainSet).toHaveBeenCalledWith(
        KEYCHAIN_PASSPHRASE_STATE_KEY,
        Buffer.from(MOCK_RESOLVED_PS, 'utf-8'),
      );
    });

    it('throws when hidden wallet resolve returns undefined instead of silently using standard wallet', async () => {
      const { deps } = makeDeps({
        resolveByMode: jest.fn(async () => undefined),
      });
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'on_host',
        deps,
      });

      await expect(signer.getAddress('evm--1')).rejects.toThrow(
        /Failed to resolve passphrase state/,
      );
    });
  });

  describe('signTransaction', () => {
    it('builds EIP-1559 hardware tx and assembles signed rawTx', async () => {
      const { deps, mocks } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      const encodedTx = {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0x',
        chainId: '1',
        nonce: '0x1',
        gasLimit: '0x5208',
        maxFeePerGas: '0x3b9aca00',
        maxPriorityFeePerGas: '0x3b9aca00',
      };

      const signed = await signer.signTransaction({
        networkId: 'evm--1',
        account: {
          address: encodedTx.from,
          path: "m/44'/60'/0'/0/0",
        },
        unsignedTx: { encodedTx },
      });

      expect(mocks.sdk.evmSignTransaction).toHaveBeenCalledTimes(1);
      const [connectId, deviceId, txParams] =
        mocks.sdk.evmSignTransaction.mock.calls[0];
      expect(connectId).toBe(DEVICE.connectId);
      expect(deviceId).toBe(DEVICE.deviceId);
      expect(txParams.transaction).toMatchObject({
        maxFeePerGas: '0x3b9aca00',
        maxPriorityFeePerGas: '0x3b9aca00',
        gasPrice: undefined,
        chainId: 1,
        nonce: '0x1',
        gasLimit: '0x5208',
      });
      expect(signed.rawTx).toMatch(/^0x02/);
      expect(signed.txid).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it('builds legacy hardware tx when only gasPrice provided', async () => {
      const { deps, mocks } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      const encodedTx = {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0x',
        chainId: 1,
        nonce: '0x0',
        gasLimit: '0x5208',
        gasPrice: '0x3b9aca00',
      };

      await signer.signTransaction({
        networkId: 'evm--1',
        account: {
          address: encodedTx.from,
          path: "m/44'/60'/0'/0/0",
        },
        unsignedTx: { encodedTx },
      });

      const txParams = mocks.sdk.evmSignTransaction.mock.calls[0][2];
      expect(txParams.transaction).toMatchObject({
        gasPrice: '0x3b9aca00',
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      });
    });
  });

  describe('signMessage', () => {
    it('converts utf-8 to hex and sends to device', async () => {
      const { deps, mocks } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      const sig = await signer.signMessage({
        networkInfo: {
          networkChainCode: 'evm',
          chainId: '1',
          networkImpl: 'evm',
          networkId: 'evm--1',
        },
        account: { address: '0xabc', path: "m/44'/60'/0'/0/0" },
        unsignedMsg: { type: 1, message: 'hello' } as unknown as never,
      } as never);

      expect(sig).toBe('0xdeadbeef');
      const params = mocks.sdk.evmSignMessage.mock.calls[0][2];
      expect(params.messageHex).toBe(
        Buffer.from('hello', 'utf8').toString('hex'),
      );
    });

    it('strips 0x and passes hex directly for hex input', async () => {
      const { deps, mocks } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      await signer.signMessage({
        networkInfo: {
          networkChainCode: 'evm',
          chainId: '1',
          networkImpl: 'evm',
          networkId: 'evm--1',
        },
        account: { address: '0xabc', path: "m/44'/60'/0'/0/0" },
        unsignedMsg: { type: 1, message: '0xCAFEBABE' } as unknown as never,
      } as never);

      const params = mocks.sdk.evmSignMessage.mock.calls[0][2];
      expect(params.messageHex).toBe('CAFEBABE');
    });

    it('throws when payload.account.path is missing', async () => {
      const { deps } = makeDeps();
      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      await expect(
        signer.signMessage({
          networkInfo: {
            networkChainCode: 'evm',
            chainId: '1',
            networkImpl: 'evm',
            networkId: 'evm--1',
          },
          // intentionally no account
          unsignedMsg: { type: 1, message: 'hi' } as unknown as never,
        } as never),
      ).rejects.toThrow('signMessage requires payload.account.path');
    });
  });

  describe('connectId refresh on init', () => {
    it('refreshes stale connectId from searchDevices before SDK calls', async () => {
      const STALE_CONNECT_ID = 'stale-connect-old';
      const FRESH_CONNECT_ID = 'fresh-connect-new';
      const staleDevice: DeviceInfo = {
        ...DEVICE,
        connectId: STALE_CONNECT_ID,
      };

      const { deps, mocks } = makeDeps({
        sdk: {
          searchDevices: jest.fn(async () =>
            makeSuccess([
              {
                connectId: FRESH_CONNECT_ID,
                deviceId: DEVICE.deviceId,
                features: {
                  device_id: DEVICE.deviceId,
                  session_id: MOCK_FRESH_SID_AFTER_RESOLVE,
                },
              },
            ]),
          ),
        } as unknown as Partial<CoreApi>,
      });

      const signer = new SignerHardware({
        device: staleDevice,
        passphraseMode: 'none',
        deps,
      });

      await signer.getAddress('evm--1');

      // searchDevices should have been called during init to refresh connectId
      expect(mocks.sdk.searchDevices).toHaveBeenCalled();
      // The SDK call should use the FRESH connectId, not the stale one
      const [connectId] = mocks.sdk.evmGetAddress.mock.calls[0];
      expect(connectId).toBe(FRESH_CONNECT_ID);
      expect(connectId).not.toBe(STALE_CONNECT_ID);
    });

    it('keeps original connectId when searchDevices fails', async () => {
      const { deps, mocks } = makeDeps({
        sdk: {
          searchDevices: jest.fn(async () => ({
            success: false,
            payload: { error: 'USB transport error' },
          })),
        } as unknown as Partial<CoreApi>,
      });

      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      await signer.getAddress('evm--1');

      // Should fall back to original connectId
      const [connectId] = mocks.sdk.evmGetAddress.mock.calls[0];
      expect(connectId).toBe(DEVICE.connectId);
    });

    it('keeps original connectId when device not found in search results', async () => {
      const { deps, mocks } = makeDeps({
        sdk: {
          searchDevices: jest.fn(async () =>
            makeSuccess([
              {
                connectId: 'other-device-connect',
                deviceId: 'other-device-id',
                features: { device_id: 'other-device-id' },
              },
            ]),
          ),
        } as unknown as Partial<CoreApi>,
      });

      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      await signer.getAddress('evm--1');

      // Should fall back to original connectId since our device wasn't found
      const [connectId] = mocks.sdk.evmGetAddress.mock.calls[0];
      expect(connectId).toBe(DEVICE.connectId);
    });
  });

  describe('SDK failure propagation', () => {
    it('wraps evmGetAddress failures in AppError with "Hardware getAddress failed"', async () => {
      const { deps, mocks } = makeDeps();
      (mocks.sdk.evmGetAddress as jest.Mock).mockResolvedValueOnce({
        success: false,
        payload: { error: 'device busy', code: 500 },
      });

      const signer = new SignerHardware({
        device: DEVICE,
        passphraseMode: 'none',
        deps,
      });

      await expect(signer.getAddress('evm--1')).rejects.toThrow(
        /Hardware getAddress failed: device busy/,
      );
    });
  });
});
