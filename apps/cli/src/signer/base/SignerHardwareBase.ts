import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import {
  ensureSDKReady,
  installPassphraseProvider,
  resolvePassphraseStateByMode,
} from '../../commands/device/hardware-sdk';
import { PASSPHRASE_MODE_NONE } from '../../core/auth/auth-types';
import { KeychainStorage } from '../../infra/keychain-storage';
import {
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from '../keychain-keys';

import type { DeviceInfo, PassphraseMode } from '../../core/auth/auth-types';
import type { ISignTransactionPayload, ISigner } from '../types';
import type { CoreApi } from '@onekeyfe/hd-core';

/** Injected collaborators — production callers never pass these. Test seam. */
export interface ISignerHardwareDeps {
  ensureSDKReady: typeof ensureSDKReady;
  installPassphraseProvider: typeof installPassphraseProvider;
  resolvePassphraseStateByMode: typeof resolvePassphraseStateByMode;
  keychainFactory: () => {
    get(key: string): Promise<Buffer | null>;
    set(key: string, value: Buffer): Promise<void>;
  };
  preloadSessionCache: (
    deviceId: string,
    passphraseState: string,
    sessionId: string,
  ) => void;
  stderr: { write(chunk: string): boolean };
}

export interface ISignerHardwareConfig {
  device: DeviceInfo;
  passphraseMode: PassphraseMode;
  /** Test seam. Production callers never pass this. */
  deps?: Partial<ISignerHardwareDeps>;
}

export function createDefaultSignerHardwareDeps(): ISignerHardwareDeps {
  return {
    ensureSDKReady,
    installPassphraseProvider,
    resolvePassphraseStateByMode,
    keychainFactory: () => new KeychainStorage(),
    preloadSessionCache: (deviceId, passphraseState, sessionId) => {
      // Lazily require — hd-core is external and CJS-packaged, so ESM
      // default-interop would break bundling.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { preloadSessionCache } =
        require('@onekeyfe/hd-core') as typeof import('@onekeyfe/hd-core');
      preloadSessionCache(deviceId, passphraseState, sessionId);
    },
    stderr: process.stderr,
  };
}

/**
 * Shared base for chain-specific hardware signers — owns the unlock /
 * passphrase / session-cache plumbing so subclasses only implement the
 * three chain-specific SDK calls (`getAddress`, `signTransaction`,
 * `signMessage`). Kit-bg analogue: `KeyringHardwareBase`.
 */
export abstract class SignerHardwareBase implements ISigner {
  protected readonly device: DeviceInfo;

  protected readonly passphraseMode: PassphraseMode;

  protected readonly deps: ISignerHardwareDeps;

  /** NEVER persisted — dies when the CLI process exits. */
  private cachedPassphraseState: string | undefined;

  /** All hardware SDK calls await this before proceeding. */
  private hwInitPromise: Promise<void> | undefined;

  /** Locking invalidates passphrase sessions, so keychain reuse is skipped when true. */
  private deviceWasLocked = false;

  constructor(config: ISignerHardwareConfig) {
    this.device = config.device;
    this.passphraseMode = config.passphraseMode;
    this.deps = { ...createDefaultSignerHardwareDeps(), ...config.deps };

    // Install persistent passphrase provider as a fallback for SDK
    // REQUEST_PASSPHRASE events (fires when session cache misses).
    this.deps.installPassphraseProvider(this.passphraseMode);

    // Unlock device + preload session cache from keychain. Must unlock
    // first: locked devices reject cached sessions.
    this.hwInitPromise = this.ensureDeviceUnlocked().then(() => {
      if (this.passphraseMode !== PASSPHRASE_MODE_NONE) {
        return this.preloadSessionFromKeychain();
      }
    });
  }

  abstract getAddress(networkId: string): Promise<ICoreApiGetAddressItem>;

  abstract signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro>;

  abstract signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;

  /**
   * Await hardware init (unlock + session preload) then return the shared SDK.
   * Subclasses must call this before any `sdk.*` invocation.
   */
  protected async getHardwareSDK(): Promise<CoreApi> {
    if (this.hwInitPromise) {
      await this.hwInitPromise;
      this.hwInitPromise = undefined;
    }
    return this.deps.ensureSDKReady();
  }

  /**
   * Resolve the common parameters to splat into every SDK call:
   *   - 'none'    → useEmptyPassphrase + skipPassphraseCheck
   *   - hidden    → passphraseState + skipPassphraseCheck
   *
   * Resolves passphraseState with a 4-step chain: in-process cache → keychain
   * → fresh SDK resolve (pinentry / device) → empty-passphrase fallback.
   */
  protected async getHwCommonParams(): Promise<{
    useEmptyPassphrase?: true;
    passphraseState?: string;
    skipPassphraseCheck?: true;
  }> {
    if (this.passphraseMode === PASSPHRASE_MODE_NONE) {
      return {
        useEmptyPassphrase: true as const,
        skipPassphraseCheck: true as const,
      };
    }

    // skipPassphraseCheck: the unlock-first flow handles device state.
    // If the session is stale, the SDK fires REQUEST_PASSPHRASE which the
    // installed provider handles automatically — no error-112 retry needed.
    const base = { skipPassphraseCheck: true as const };

    // 1. Reuse in-process cache.
    if (this.cachedPassphraseState) {
      return { ...base, passphraseState: this.cachedPassphraseState };
    }

    // 2. Try keychain (persisted at login) — skip if device was locked
    //    (locking invalidates passphrase sessions; cached state is useless).
    if (!this.deviceWasLocked) {
      try {
        const keychain = this.deps.keychainFactory();
        const buf = await keychain.get(KEYCHAIN_PASSPHRASE_STATE_KEY);
        if (buf) {
          this.cachedPassphraseState = buf.toString('utf-8');
          return { ...base, passphraseState: this.cachedPassphraseState };
        }
      } catch {
        // Keychain unavailable — fall through to SDK prompt.
      }
    }

    // 3. Keychain miss — resolve fresh via SDK (prompts pinentry / device).
    this.cachedPassphraseState = await this.deps.resolvePassphraseStateByMode(
      this.device.connectId,
      this.passphraseMode,
    );

    // 4. Persist to keychain (best-effort) + preload session for this run.
    // passphraseState from the SDK is an opaque token (format is SDK's
    // business — currently base58/URL-safe ASCII). Encode as utf-8 so
    // any string round-trips losslessly through the keychain layer.
    if (this.cachedPassphraseState) {
      try {
        const keychain = this.deps.keychainFactory();
        await keychain.set(
          KEYCHAIN_PASSPHRASE_STATE_KEY,
          Buffer.from(this.cachedPassphraseState, 'utf-8'),
        );
        await this.preloadSessionFromKeychain();
      } catch {
        // non-fatal: keychain may be locked / unavailable; we already
        // have the state in memory for this process.
      }
    }

    if (this.cachedPassphraseState) {
      return { ...base, passphraseState: this.cachedPassphraseState };
    }
    return {
      useEmptyPassphrase: true as const,
      skipPassphraseCheck: true as const,
    };
  }

  private async ensureDeviceUnlocked(): Promise<void> {
    try {
      const sdk = await this.deps.ensureSDKReady();
      const featResult = await sdk.getFeatures(this.device.connectId);
      if (
        featResult?.success &&
        featResult.payload &&
        (featResult.payload as { unlocked?: boolean }).unlocked === false
      ) {
        this.deviceWasLocked = true;
        this.deps.stderr.write(
          '[hardware] Device is locked. Please enter PIN on device...\n',
        );
        await sdk.deviceUnlock(this.device.connectId, {});
      }
    } catch {
      // Non-fatal — proceed anyway, SDK will surface errors on real calls.
    }
  }

  private async preloadSessionFromKeychain(): Promise<void> {
    // Skip if device was locked — session is invalid after lock/unlock cycle.
    if (this.deviceWasLocked) return;

    try {
      const keychain = this.deps.keychainFactory();
      const [psBuf, sidBuf] = await Promise.all([
        keychain.get(KEYCHAIN_PASSPHRASE_STATE_KEY),
        keychain.get(KEYCHAIN_SESSION_ID_KEY),
      ]);
      if (psBuf && sidBuf) {
        const passphraseState = psBuf.toString('utf-8');
        const sessionId = sidBuf.toString('utf-8');
        this.deps.preloadSessionCache(
          this.device.deviceId,
          passphraseState,
          sessionId,
        );
      }
    } catch {
      // Non-fatal — fallback to passphrase prompt via the installed provider.
    }
  }
}
