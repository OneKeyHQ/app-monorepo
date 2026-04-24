import { WALLET_TYPE_HW } from '@onekeyhq/shared/src/consts/dbConsts';

import {
  AUTH_LOGIN_METHOD_HARDWARE,
  PASSPHRASE_MODE_NONE,
  PASSPHRASE_MODE_ON_DEVICE,
  PASSPHRASE_MODE_ON_HOST,
} from '../../core/auth/auth-types';
import { AppError, ERROR_CODES } from '../../errors';
import {
  AUTH_SESSION_SCHEMA_VERSION,
  AuthSessionStore,
} from '../../infra/auth-session-store';
import { KeychainStorage } from '../../infra/keychain-storage';
import { presentAuthLoginResult } from '../../output/auth-presenters';
import {
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from '../../signer/keychain-keys';
import { promptPassphraseViaPinentry } from '../../utils/pinentry';
import {
  ensureSDKReady,
  resolvePassphraseState,
  searchDevice,
  unwrapSDKResult,
} from '../device/hardware-sdk';

import type {
  PassphraseMode,
  ResolvedAuthSession,
} from '../../core/auth/auth-types';
import type { OutputFormatter } from '../../output';

interface IHardwareLoginDeps {
  output: OutputFormatter;
  isTTY?: boolean;
  isHumanMode?: boolean;
  getStatus: () => Promise<ResolvedAuthSession>;
}

/**
 * Prompt the user to choose one of three passphrase modes.
 */
async function promptPassphraseMode(
  _output: OutputFormatter,
): Promise<PassphraseMode> {
  const { createInterface } = await import('node:readline');
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    // readline.close() synchronously emits 'close', so the handler below
    // must distinguish a real EOF (Ctrl+D) from the normal teardown we
    // trigger after a valid answer. Without this flag, rl.close() in the
    // answer branches would reject the Promise before resolve() runs.
    let answered = false;
    rl.on('close', () => {
      if (answered) return;
      reject(
        new AppError(
          ERROR_CODES.AUTH_NO_WALLET.code,
          'Input closed before passphrase mode was selected',
          'Run the command again in an interactive terminal',
        ),
      );
    });

    const finish = (mode: PassphraseMode) => {
      answered = true;
      resolve(mode);
      rl.close();
    };

    const prompt = () => {
      process.stderr.write(
        [
          'Select wallet type:',
          '  1. Standard wallet (no passphrase)',
          '  2. Hidden wallet — enter passphrase on this computer (via pinentry)',
          '  3. Hidden wallet — enter passphrase on device screen',
        ].join('\n'),
      );
      process.stderr.write('\n');

      rl.question('Enter selection [1/2/3]: ', (answer) => {
        const normalized = answer.trim();
        if (normalized === '1') {
          finish(PASSPHRASE_MODE_NONE);
          return;
        }
        if (normalized === '2') {
          finish(PASSPHRASE_MODE_ON_HOST);
          return;
        }
        if (normalized === '3') {
          finish(PASSPHRASE_MODE_ON_DEVICE);
          return;
        }
        process.stderr.write('Invalid selection. Enter 1, 2, or 3.\n');
        prompt();
      });
    };

    prompt();
  });
}

/**
 * Hardware login flow:
 *
 * 1. Guard: no existing session
 * 2. searchDevice() → find connected device
 * 3. User selects passphrase mode:
 *    - none: standard wallet (useEmptyPassphrase)
 *    - on_host: passphrase entered via pinentry (secure OS dialog)
 *    - on_device: passphrase entered on device screen
 * 4. Resolve passphraseState via device, then cache in OS keychain
 * 5. Get address from device
 * 6. Persist session.json with device info + passphraseMode
 *
 * SECURITY:
 * - Passphrase (user-entered text) NEVER touches disk — only the
 *   derived passphraseState session token is cached in the OS keychain
 * - Passphrase NEVER appears in shell history or terminal output
 * - passphraseState is persisted to the OS keychain so follow-up
 *   commands can reuse the session without re-prompting
 * - Session stores the MODE (how to re-prompt if cache is stale)
 * - If the device is locked between commands, the cached session is
 *   invalidated and the user is re-prompted via pinentry/device
 */
export async function executeHardwareLoginCommand({
  output,
  isTTY = process.stdin.isTTY ?? false,
  isHumanMode = false,
  getStatus,
}: IHardwareLoginDeps): Promise<void> {
  // Guard: no existing session
  const currentSession = await getStatus();
  if (currentSession.authStatus === 'authenticated') {
    throw new AppError(
      ERROR_CODES.AUTH_WALLET_EXISTS.code,
      'Wallet already exists. Log out before importing another wallet.',
      'Run: onekey auth logout',
    );
  }

  // Step 1: Find device
  output.info('Searching for OneKey hardware device...');
  const { connectId, deviceId } = await searchDevice();

  // Get device features for label
  const sdk = await ensureSDKReady();
  const featuresResult = await sdk.getFeatures(connectId);
  let features = unwrapSDKResult(featuresResult, 'getFeatures') as {
    label?: string;
    device_id?: string;
    model?: string;
    unlocked?: boolean | null;
    passphrase_protection?: boolean | null;
  };

  // Unlock if locked (matches app-monorepo ServiceHardware.getFeaturesWithUnlock)
  if (features.unlocked === false) {
    output.info('Device is locked. Please enter PIN on device...');
    const unlockResult = await sdk.deviceUnlock(connectId, {});
    features = unwrapSDKResult(unlockResult, 'deviceUnlock') as typeof features;
  }

  const deviceLabel =
    features.label || features.model || `OneKey-${deviceId.slice(0, 8)}`;

  output.info(`Found device: ${deviceLabel} (${deviceId})`);

  // Step 2: Select passphrase mode
  let passphraseMode: PassphraseMode = PASSPHRASE_MODE_NONE;
  let passphraseState: string | undefined;

  if (isTTY && isHumanMode) {
    passphraseMode = await promptPassphraseMode(output);
  }

  // Step 3: Resolve passphraseState in memory (never persisted)
  if (passphraseMode === PASSPHRASE_MODE_ON_HOST) {
    // Use pinentry for secure passphrase input — no terminal echo, no shell history
    const passphrase = await promptPassphraseViaPinentry();
    output.info('Resolving passphrase state on device...');
    passphraseState = await resolvePassphraseState(connectId, {
      passphrase,
    });
    // passphrase string is now eligible for GC — we only keep passphraseState in memory
  } else if (passphraseMode === PASSPHRASE_MODE_ON_DEVICE) {
    output.info('Please enter passphrase on device screen...');
    passphraseState = await resolvePassphraseState(connectId, {
      passphraseOnDevice: true,
    });
  }
  // passphraseMode === PASSPHRASE_MODE_NONE → no passphrase needed

  // Step 4: Persist passphraseState + sessionId to keychain BEFORE
  // evmGetAddress, and preload session cache. This ensures evmGetAddress
  // can use the session_id and skip the second passphrase prompt.
  if (passphraseState) {
    const keychain = new KeychainStorage();
    await keychain.set(
      KEYCHAIN_PASSPHRASE_STATE_KEY,
      Buffer.from(passphraseState, 'utf-8'),
    );

    // Get session_id from device features (set by resolvePassphraseState)
    const refreshResult = await sdk.searchDevices();
    const refreshedDevices = unwrapSDKResult(
      refreshResult,
      'searchDevices',
    ) as Array<{
      features?: { session_id?: string; device_id?: string };
    }>;
    const sessionId = refreshedDevices?.[0]?.features?.session_id;
    const resolvedDeviceId =
      refreshedDevices?.[0]?.features?.device_id || deviceId;
    if (sessionId) {
      await keychain.set(
        KEYCHAIN_SESSION_ID_KEY,
        Buffer.from(sessionId, 'utf-8'),
      );

      // Preload session cache so evmGetAddress below doesn't re-prompt
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { preloadSessionCache } =
          require('@onekeyfe/hd-core') as typeof import('@onekeyfe/hd-core');
        preloadSessionCache(resolvedDeviceId, passphraseState, sessionId);
      } catch {
        // non-fatal
      }
    }
  }

  // Step 5: Get address from device (no passphrase prompt — session preloaded)
  output.info('Fetching address from device...');
  const commonParams = passphraseState
    ? { passphraseState }
    : { useEmptyPassphrase: true as const };

  const addressResult = await sdk.evmGetAddress(connectId, deviceId, {
    path: "m/44'/60'/0'/0/0",
    showOnOneKey: false,
    ...commonParams,
  });

  const addressPayload = unwrapSDKResult(addressResult, 'getAddress') as {
    address: string;
    path: string;
  };
  const displayAddress = addressPayload.address;

  output.info(`Device address: ${displayAddress}`);

  // Step 6: Persist session.json
  const sessionStore = new AuthSessionStore();
  await sessionStore.save({
    schemaVersion: AUTH_SESSION_SCHEMA_VERSION,
    loginMethod: AUTH_LOGIN_METHOD_HARDWARE,
    walletKind: WALLET_TYPE_HW,
    displayAddress,
    importedAt: new Date().toISOString(),
    sourceLabel: `Hardware: ${deviceLabel}`,
    device: {
      connectId,
      deviceId,
      deviceLabel,
    },
    passphraseMode,
  });

  // Step 7: Show result
  const finalSession = await getStatus();
  output.success(presentAuthLoginResult(finalSession));
}
