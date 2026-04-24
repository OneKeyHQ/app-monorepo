import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import {
  CoreSDKLoader,
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

/** Test seam for injected collaborators. */
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
  ) => Promise<void> | void;
  stderr: { write(chunk: string): boolean };
}

export interface ISignerHardwareConfig {
  device: DeviceInfo;
  passphraseMode: PassphraseMode;
  deps?: Partial<ISignerHardwareDeps>;
}

export function createDefaultSignerHardwareDeps(): ISignerHardwareDeps {
  return {
    ensureSDKReady,
    installPassphraseProvider,
    resolvePassphraseStateByMode,
    keychainFactory: () => new KeychainStorage(),
    preloadSessionCache: async (deviceId, passphraseState, sessionId) => {
      const { preloadSessionCache } = await CoreSDKLoader();
      preloadSessionCache(deviceId, passphraseState, sessionId);
    },
    stderr: process.stderr,
  };
}

/**
 * Shared base for chain-specific hardware signers. Owns unlock, passphrase
 * and session-cache plumbing so subclasses only implement `getAddress`,
 * `signTransaction`, `signMessage`. Kit-bg analogue: `KeyringHardwareBase`.
 */
export abstract class SignerHardwareBase implements ISigner {
  protected readonly device: DeviceInfo;

  protected readonly passphraseMode: PassphraseMode;

  protected readonly deps: ISignerHardwareDeps;

  /** In-memory only — dies with the CLI process. */
  private cachedPassphraseState: string | undefined;

  private hwInitPromise: Promise<void> | undefined;

  /** Locking invalidates passphrase sessions → cached state is unusable. */
  private deviceWasLocked = false;

  constructor(config: ISignerHardwareConfig) {
    this.device = config.device;
    this.passphraseMode = config.passphraseMode;
    this.deps = { ...createDefaultSignerHardwareDeps(), ...config.deps };

    // Fallback for SDK REQUEST_PASSPHRASE events (fires on session-cache miss).
    this.deps.installPassphraseProvider(this.passphraseMode);

    // Unlock first — locked devices reject cached sessions.
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

  /** Awaits unlock + session preload, then returns the shared SDK. */
  protected async getHardwareSDK(): Promise<CoreApi> {
    if (this.hwInitPromise) {
      await this.hwInitPromise;
      this.hwInitPromise = undefined;
    }
    return this.deps.ensureSDKReady();
  }

  /**
   * Common parameters spread into every SDK call.
   * skipPassphraseCheck: unlock-first flow already owns device state; on a
   * stale session the SDK fires REQUEST_PASSPHRASE and the installed
   * provider responds, so the error-112 retry dance is unnecessary.
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

    const state = await this.resolvePassphraseState();
    if (state) {
      return { skipPassphraseCheck: true as const, passphraseState: state };
    }
    return {
      useEmptyPassphrase: true as const,
      skipPassphraseCheck: true as const,
    };
  }

  /** Fallback chain: cache → keychain → fresh SDK resolve. */
  private async resolvePassphraseState(): Promise<string | undefined> {
    if (this.cachedPassphraseState) {
      return this.cachedPassphraseState;
    }

    const fromKeychain = await this.readPassphraseStateFromKeychain();
    if (fromKeychain) {
      this.cachedPassphraseState = fromKeychain;
      return fromKeychain;
    }

    const fresh = await this.deps.resolvePassphraseStateByMode(
      this.device.connectId,
      this.passphraseMode,
    );
    if (fresh) {
      this.cachedPassphraseState = fresh;
      await this.persistPassphraseState(fresh);
    }
    return fresh || undefined;
  }

  private async readPassphraseStateFromKeychain(): Promise<string | undefined> {
    if (this.deviceWasLocked) return undefined;
    try {
      const buf = await this.deps
        .keychainFactory()
        .get(KEYCHAIN_PASSPHRASE_STATE_KEY);
      return buf?.toString('utf-8');
    } catch {
      return undefined;
    }
  }

  // passphraseState is an opaque SDK token (currently base58/URL-safe ASCII);
  // utf-8 round-trips any string through the keychain layer.
  //
  // After a lock/unlock cycle the keychain still holds the previous login's
  // session-id, which is now invalid on the device. We must refresh BOTH
  // keys atomically — a fresh passphrase-state paired with a stale
  // session-id makes the next process feed the SDK a rejected combo, and
  // every command keeps re-prompting through pinentry.
  // Mirrors hardware-login-command.ts' post-resolve persistence step.
  private async persistPassphraseState(state: string): Promise<void> {
    const keychain = this.deps.keychainFactory();
    try {
      await keychain.set(
        KEYCHAIN_PASSPHRASE_STATE_KEY,
        Buffer.from(state, 'utf-8'),
      );
    } catch {
      // non-fatal — in-memory state still works this run.
      return;
    }

    try {
      const sdk = await this.deps.ensureSDKReady();
      const search = await sdk.searchDevices();
      if (!search?.success) return;
      const devices = search.payload as Array<{
        deviceId?: string | null;
        features?: { device_id?: string; session_id?: string };
      }>;
      // Match on the stable deviceId (device UUID) rather than connectId —
      // USB connectId is a per-session transport handle that may be reassigned
      // across CLI invocations, so connectId-based matching breaks session
      // reuse after a process restart. Mirrors the app-monorepo strategy of
      // `localDb.getDeviceByQuery({ featuresDeviceId })`.
      const match = devices.find((d) => d.deviceId === this.device.deviceId);
      const sessionId = match?.features?.session_id;
      if (!sessionId) return;

      await keychain.set(
        KEYCHAIN_SESSION_ID_KEY,
        Buffer.from(sessionId, 'utf-8'),
      );
      // Warm the in-process SDK cache too. Idempotent — getPassphraseState
      // already populated it for this run, but doing it here keeps the path
      // consistent with how hardware-login-command primes the cache.
      await this.deps.preloadSessionCache(
        this.device.deviceId,
        state,
        sessionId,
      );
    } catch {
      // non-fatal — next run will pop pinentry once until the session is
      // rebuilt; no security or data-loss consequence.
    }
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
      // non-fatal — SDK will surface real errors on the next call.
    }
  }

  private async preloadSessionFromKeychain(): Promise<void> {
    // Session is invalid after a lock/unlock cycle.
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
        await this.deps.preloadSessionCache(
          this.device.deviceId,
          passphraseState,
          sessionId,
        );
      }
    } catch {
      // non-fatal — fall back to the installed passphrase provider.
    }
  }
}
