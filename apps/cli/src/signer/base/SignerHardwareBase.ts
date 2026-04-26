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
import { AppError, ERROR_CODES } from '../../errors';
import { KeychainStorage } from '../../infra/keychain-storage';
import {
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
  persistKeychainSessionPair,
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
    delete(key: string): Promise<void>;
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

    // Refresh connectId first — the value from session.json is a USB transport
    // handle captured at login time. After a replug or process restart it may
    // be stale. searchDevices() returns the current handle for the same stable
    // deviceId, so all subsequent SDK calls hit the right transport.
    // Then unlock — locked devices reject cached sessions.
    this.hwInitPromise = this.refreshConnectId()
      .then(() => this.ensureDeviceUnlocked())
      .then(() => {
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
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      `Failed to resolve passphrase state for mode "${this.passphraseMode}".`,
      'Run: onekey auth logout && onekey auth login --hardware',
    );
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
  // keys atomically — persistKeychainSessionPair enforces this invariant.
  // Mirrors hardware-login-command.ts' post-resolve persistence step.
  private async persistPassphraseState(state: string): Promise<void> {
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

      // Write both keys as a pair — never one without the other.
      const keychain = this.deps.keychainFactory();
      await persistKeychainSessionPair(keychain, state, sessionId);

      // Warm the in-process SDK cache too. Idempotent — getPassphraseState
      // already populated it for this run, but doing it here keeps the path
      // consistent with how hardware-login-command primes the cache.
      await this.deps.preloadSessionCache(
        this.device.deviceId,
        state,
        sessionId,
      );
    } catch {
      // non-fatal — in-memory state still works this run; next run will
      // pop pinentry once until the session is rebuilt.
    }
  }

  /**
   * Refresh `this.device.connectId` by searching for the device via stable
   * `deviceId`. USB connectId is a per-session transport handle that changes
   * when the device is reconnected or the process restarts. The value stored
   * in session.json is from login time and may be stale. This method
   * resolves the current connectId so all subsequent SDK calls target the
   * correct transport.
   *
   * Non-fatal: if searchDevices fails, we keep the original connectId as a
   * best-effort hint — the SDK will surface real errors on the next call.
   */
  private async refreshConnectId(): Promise<void> {
    try {
      const sdk = await this.deps.ensureSDKReady();
      const result = await sdk.searchDevices();
      if (!result?.success) return;
      const devices = result.payload as Array<{
        connectId?: string | null;
        deviceId?: string | null;
        features?: { device_id?: string };
      }>;
      if (!Array.isArray(devices)) return;
      // Match on stable deviceId (device UUID), not connectId.
      const match = devices.find(
        (d) =>
          d.deviceId === this.device.deviceId ||
          d.features?.device_id === this.device.deviceId,
      );
      if (match?.connectId) {
        this.device.connectId = match.connectId;
      }
    } catch {
      // non-fatal — keep original connectId; SDK will surface real errors.
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
