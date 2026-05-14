/**
 * Shared hardware SDK accessor for device commands and hardware signers.
 * Initializes SDK + USB transport once, reuses across commands.
 *
 * Singleton pattern: sdkReadyPromise ensures concurrent callers all wait on
 * the same initialization rather than racing to call sdk.init() multiple times.
 */

import { AppError, ERROR_CODES } from '../../errors';

import type { PassphraseMode } from '../../core/auth/auth-types';
import type { CoreApi } from '@onekeyfe/hd-core';

/**
 * CLI-local analogue of `@onekeyhq/shared` `CoreSDKLoader`.
 *
 * Node 22 CJS runtime double-defaults `module.exports` when called via
 * dynamic `import()`, so named exports from `@onekeyfe/hd-core` are
 * unreachable that way. `require()` returns `module.exports` directly and
 * preserves the named exports. The `.eslintrc.js` rule bans static imports
 * of `@onekeyfe/hd-core`; route all value-level access through this helper
 * so the `require` call stays in one audited place.
 */
export const CoreSDKLoader = async (): Promise<
  typeof import('@onekeyfe/hd-core')
> =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@onekeyfe/hd-core') as typeof import('@onekeyfe/hd-core');

// Promise-singleton: set on first call, reused by all concurrent callers.
// Using a Promise instead of a boolean flag eliminates the race condition
// where two concurrent ensureSDKReady() calls could both enter the init block
// before sdkInitialized is set.
let sdkReadyPromise: Promise<CoreApi> | null = null;
let hardwareSDKQueueTail: Promise<void> = Promise.resolve();

const SDK_QUEUE_BYPASS_METHODS = new Set<PropertyKey>([
  'addListener',
  'cancel',
  'dispose',
  'emit',
  'eventNames',
  'getMaxListeners',
  'init',
  'listenerCount',
  'listeners',
  'off',
  'on',
  'once',
  'prependListener',
  'prependOnceListener',
  'rawListeners',
  'removeListener',
  'removeAllListeners',
  'setMaxListeners',
  'uiResponse',
]);

type HardwareMethod = (...args: unknown[]) => unknown;

function enqueueHardwareSDKCall<T>(call: () => T | Promise<T>): Promise<T> {
  const run = hardwareSDKQueueTail.then(call, call);
  hardwareSDKQueueTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function resetHardwareSDKQueue() {
  hardwareSDKQueueTail = Promise.resolve();
}

/**
 * CLI analogue of app-monorepo's hardware processing boundary.
 *
 * The Node USB transport and SDK UI/passphrase state are process-wide serial
 * resources. Returning a queued facade makes accidental concurrent SDK
 * calls (for example Promise.all inside a signer) execute FIFO instead of
 * interrupting the device with code 107. Queue-bypass methods must stay
 * immediate so PIN/passphrase responses and cancel can reach the SDK.
 */
export function createQueuedHardwareSDK<T extends object>(sdk: T): T {
  const methodCache = new Map<PropertyKey, unknown>();

  return new Proxy(sdk, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      const cached = methodCache.get(prop);
      if (cached) {
        return cached;
      }

      const method = (...args: unknown[]) => {
        const hardwareMethod = value as HardwareMethod;
        const call = (): unknown => Reflect.apply(hardwareMethod, target, args);
        if (SDK_QUEUE_BYPASS_METHODS.has(prop)) {
          return call();
        }
        return enqueueHardwareSDKCall(call);
      };
      methodCache.set(prop, method);
      return method;
    },
  });
}

/**
 * Release the USB transport and dispose the SDK instance.
 * Must be called before the CLI process exits — the USB transport holds open
 * handles (event listeners, polling timers) that prevent Node.js from exiting
 * naturally. Without this call the process hangs for ~26 seconds.
 */
export async function disposeSDK(): Promise<void> {
  if (!sdkReadyPromise) return;
  try {
    const sdk = await sdkReadyPromise;
    sdk.dispose();
  } catch {
    // ignore errors during cleanup
  } finally {
    sdkReadyPromise = null;
    resetHardwareSDKQueue();
  }
}

// Per-call passphrase provider — set before SDK calls that may trigger
// REQUEST_PASSPHRASE, cleared after. Supports async providers (e.g. pinentry).
type IPassphraseProvider = () =>
  | { value: string; passphraseOnDevice: boolean }
  | Promise<{ value: string; passphraseOnDevice: boolean }>;
let passphraseProvider: IPassphraseProvider | undefined;

function setPassphraseProvider(
  provider: IPassphraseProvider | undefined,
): void {
  passphraseProvider = provider;
}

async function initSDK(): Promise<CoreApi> {
  // These are CJS packages. In Node.js 22 CJS context, dynamic import()
  // wraps module.exports as the namespace default — causing { default: x }
  // to grab the exports object instead of the actual value (double-default).
  // require() returns module.exports directly, so .default gives the real SDK.
  // Calls are inside initSDK() to stay lazy — only loaded when hardware is used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require('@onekeyfe/hd-common-connect-sdk').default as CoreApi;

  // hd-common-connect-sdk init accepts NodeUsbTransport class at runtime,
  // but CoreApi type declares LowLevelCoreApi — cast to bridge the gap.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NodeUsbTransport = require('@onekeyfe/hd-transport-usb')
    .default as unknown as Parameters<CoreApi['init']>[1];
  await sdk.init(
    { env: 'node-usb', debug: false, fetchConfig: true },
    NodeUsbTransport,
  );

  const { UI_EVENT, UI_REQUEST, UI_RESPONSE } = await CoreSDKLoader();

  sdk.on(
    UI_EVENT,
    (message: { type: string; payload?: Record<string, unknown> }) => {
      switch (message.type) {
        // PIN: always on-device for CLI security (no terminal echo).
        // The sentinel '@@ONEKEY_INPUT_PIN_IN_DEVICE' makes DeviceCommands
        // send `BixinPinInputOnDevice` so Classic/1S/Mini/Pure switch to
        // on-device PIN entry. An empty payload would be treated as a
        // wrong (empty) PIN and would consume a retry on those models.
        // Touch/Pro never emit PinMatrixRequest — they handle PIN on the
        // touchscreen before this code path runs.
        case UI_REQUEST.REQUEST_PIN: {
          process.stderr.write(
            '[hardware] Please enter PIN on your device screen...\n',
          );
          sdk.uiResponse({
            type: UI_RESPONSE.RECEIVE_PIN,
            payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
          });
          return;
        }

        // Passphrase: provider handles it (async-capable for pinentry).
        // Only fires when device actually needs passphrase input —
        // if device session is still active, this event is NOT triggered.
        case UI_REQUEST.REQUEST_PASSPHRASE: {
          if (passphraseProvider) {
            const resultOrPromise = passphraseProvider();
            const respond = (result: {
              value: string;
              passphraseOnDevice: boolean;
            }) => {
              sdk.uiResponse({
                type: UI_RESPONSE.RECEIVE_PASSPHRASE,
                payload: {
                  value: result.value,
                  passphraseOnDevice: result.passphraseOnDevice,
                  save: false,
                },
              });
            };
            if (resultOrPromise instanceof Promise) {
              // Without a .catch() handler, any rejection (pinentry
              // cancelled, binary missing, async I/O error) leaves the
              // SDK blocked forever waiting for uiResponse.
              // Fallback: tell the device to prompt on-device instead.
              void resultOrPromise.then(respond).catch((err: unknown) => {
                process.stderr.write(
                  `[hardware] Passphrase provider failed (${
                    err instanceof Error ? err.message : String(err)
                  }), falling back to on-device entry.\n`,
                );
                respond({ value: '', passphraseOnDevice: true });
              });
            } else {
              respond(resultOrPromise);
            }
          } else {
            // Standard wallet — empty passphrase
            sdk.uiResponse({
              type: UI_RESPONSE.RECEIVE_PASSPHRASE,
              payload: { value: '', passphraseOnDevice: false, save: false },
            });
          }
          return;
        }

        // Button confirmation: user must press button on device (e.g. sign tx, confirm address)
        // No uiResponse needed — SDK waits for device-side confirmation.
        case UI_REQUEST.REQUEST_BUTTON: {
          process.stderr.write(
            '[hardware] Please confirm the action on your OneKey device...\n',
          );
          return;
        }

        // Passphrase on device: user enters passphrase on device screen
        // No uiResponse needed — SDK waits for device-side input.
        case UI_REQUEST.REQUEST_PASSPHRASE_ON_DEVICE: {
          process.stderr.write(
            '[hardware] Please enter your passphrase on the device screen...\n',
          );
          return;
        }

        // Invalid PIN: device rejected the PIN entry
        case UI_REQUEST.INVALID_PIN: {
          process.stderr.write(
            '[hardware] Invalid PIN entered. Please try again.\n',
          );
          break;
        }

        // Other events (CLOSE_UI_WINDOW, DEVICE_PROGRESS, Bluetooth, etc.)
        // are either UI-only or irrelevant in CLI/USB context — safe to ignore.
        default:
          break;
      }
    },
  );

  return createQueuedHardwareSDK(sdk);
}

export async function ensureSDKReady(): Promise<CoreApi> {
  if (!sdkReadyPromise) {
    sdkReadyPromise = initSDK();
  }
  return sdkReadyPromise;
}

export function unwrapSDKResult<T>(
  result: {
    success: boolean;
    payload: T | { error: string; code?: string | number };
  },
  operation: string,
): T {
  if (!result.success) {
    const err = result.payload as { error?: string; code?: string | number };
    throw new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      `Hardware ${operation} failed: ${err.error ?? 'unknown'} (code ${err.code ?? '?'})`,
      'Check device connection and try again',
    );
  }
  return result.payload as T;
}

export async function searchDevice(opts?: { deviceIdHint?: string }): Promise<{
  connectId: string;
  deviceId: string;
}> {
  const sdk = await ensureSDKReady();
  const result = await sdk.searchDevices();
  const devices = unwrapSDKResult(result, 'searchDevices') as Array<{
    connectId?: string | null;
    deviceId?: string | null;
  }>;
  if (!Array.isArray(devices) || devices.length === 0) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      'No OneKey hardware device found',
      'Connect your OneKey device via USB and try again',
    );
  }
  // With a hint, select by the stable deviceId (device UUID). This is the
  // user-visible identifier printed by `onekey device search`.
  if (opts?.deviceIdHint) {
    const match = devices.find((d) => d.deviceId === opts.deviceIdHint);
    if (!match) {
      const available = devices
        .map((d) => d.deviceId ?? '<unknown>')
        .join(', ');
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CONFIG.code,
        `Device ${opts.deviceIdHint} not found among connected devices (${available})`,
        'Run `onekey device search` to list connected devices and confirm the ID.',
      );
    }
    return {
      connectId: match.connectId ?? '',
      deviceId: match.deviceId ?? '',
    };
  }
  // Without a hint, picking devices[0] would bind the command to SDK
  // enumeration order — not stable across reconnects — and silently operate
  // on the wrong device when multiple OneKeys are plugged in.
  if (devices.length > 1) {
    const available = devices.map((d) => d.deviceId ?? '<unknown>').join(', ');
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `Multiple OneKey devices detected (${devices.length}): ${available}`,
      'Pass --device-id <id> to pick one, or disconnect all but one device.',
    );
  }
  return {
    connectId: devices[0].connectId ?? '',
    deviceId: devices[0].deviceId ?? '',
  };
}

/**
 * Obtain a passphraseState session token from the device.
 *
 * Matches the app-monorepo pattern (ServiceHardware.getPassphraseStateBase):
 * - Calls sdk.getPassphraseState with initSession=true so the device
 *   prompts for passphrase entry (host input or on-device input).
 * - Returns the session token that must be passed in all subsequent
 *   SDK calls for this hidden wallet (replaces re-sending the passphrase).
 * - Returns undefined for standard wallets (no passphrase).
 */
export async function resolvePassphraseState(
  connectId: string,
  opts: { passphrase?: string; passphraseOnDevice?: boolean },
): Promise<string | undefined> {
  // BIP-39 treats an empty-string passphrase as a distinct hidden wallet
  // from the standard (no-passphrase) wallet. A falsy check would silently
  // map `{ passphrase: '' }` onto the standard wallet and derive the wrong
  // addresses. Enforce explicit intent at the API boundary so future callers
  // can't regress past the pinentry-layer guard.
  if (opts.passphrase === '') {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      'Empty passphrase string is not accepted',
      'Omit `passphrase` for the standard wallet, or provide a non-empty passphrase for a hidden wallet.',
    );
  }
  if (opts.passphrase === undefined && !opts.passphraseOnDevice) {
    return undefined; // standard wallet — no passphrase needed
  }

  const sdk = await ensureSDKReady();

  setPassphraseProvider(() => ({
    value: opts.passphrase ?? '',
    passphraseOnDevice: opts.passphraseOnDevice ?? false,
  }));

  try {
    // Matches app-monorepo ServiceHardware.getPassphraseStateBase:
    //   initSession: true  → force device to prompt for passphrase
    //   useEmptyPassphrase: false → this IS a hidden wallet session
    const result = await sdk.getPassphraseState(connectId, {
      initSession: true,
      useEmptyPassphrase: false,
    });
    if (!result.success) {
      const err = result.payload as { error?: string; code?: string | number };
      throw new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        `getPassphraseState failed: ${err.error ?? 'unknown'} (code ${err.code ?? '?'})`,
        'Check device connection and passphrase, then retry',
      );
    }
    // SDK returns the passphraseState token (a short hex string like "abc12345")
    return typeof result.payload === 'string' ? result.payload : undefined;
  } finally {
    setPassphraseProvider(undefined);
  }
}

/**
 * Resolve passphraseState based on session mode.
 *
 * Unlike resolvePassphraseState(), this function does NOT require the
 * passphrase value upfront. Instead, it sets up a lazy provider:
 *
 * - 'none': standard wallet → useEmptyPassphrase, no prompt ever
 * - 'on_host': SDK triggers REQUEST_PASSPHRASE only if device session
 *   expired → provider calls pinentry → user enters passphrase in native
 *   OS dialog. If device session is still active, no prompt at all.
 * - 'on_device': SDK triggers REQUEST_PASSPHRASE only if needed →
 *   provider tells device to show passphrase input on its screen.
 *
 * SECURITY: passphrase exists only in memory during provider callback.
 * passphraseState is returned in memory, never persisted to disk.
 */
export async function resolvePassphraseStateByMode(
  connectId: string,
  mode: PassphraseMode,
): Promise<string | undefined> {
  if (mode === 'none') {
    return undefined;
  }

  const sdk = await ensureSDKReady();

  // Set up lazy provider — only invoked when SDK fires REQUEST_PASSPHRASE.
  // If device session is still active, this callback is never called.
  if (mode === 'on_host') {
    const { promptPassphraseViaPinentry } =
      await import('../../utils/pinentry');
    setPassphraseProvider(async () => {
      const passphrase = await promptPassphraseViaPinentry();
      return { value: passphrase, passphraseOnDevice: false };
    });
  } else if (mode === 'on_device') {
    setPassphraseProvider(() => ({
      value: '',
      passphraseOnDevice: true,
    }));
  }

  try {
    const result = await sdk.getPassphraseState(connectId, {
      initSession: true,
      useEmptyPassphrase: false,
    });
    if (!result.success) {
      const err = result.payload as { error?: string; code?: string | number };
      throw new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        `getPassphraseState failed: ${err.error ?? 'unknown'} (code ${err.code ?? '?'})`,
        'Check device connection and passphrase, then retry',
      );
    }
    return typeof result.payload === 'string' ? result.payload : undefined;
  } finally {
    // Don't clear provider here — keep it active for subsequent SDK calls.
    // The SDK fires REQUEST_PASSPHRASE on every new USB connection, so the
    // provider must remain installed for the process lifetime.
  }
}

/**
 * Install a persistent passphrase provider for the current process.
 *
 * The SDK fires REQUEST_PASSPHRASE on every new USB connection — even when
 * passphraseState is already provided in the SDK call params. Without a
 * provider installed, the default handler responds with empty passphrase,
 * causing error 112 (passphrase state mismatch) for hidden wallets.
 *
 * Call once at signer initialization. Provider stays active until process exits.
 */
export function installPassphraseProvider(mode: PassphraseMode): void {
  if (mode === 'none') {
    return;
  }

  if (mode === 'on_host') {
    setPassphraseProvider(async () => {
      const { promptPassphraseViaPinentry } =
        await import('../../utils/pinentry');
      return {
        value: await promptPassphraseViaPinentry(),
        passphraseOnDevice: false,
      };
    });
  } else if (mode === 'on_device') {
    setPassphraseProvider(() => ({
      value: '',
      passphraseOnDevice: true,
    }));
  }
}
