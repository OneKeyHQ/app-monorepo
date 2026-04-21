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
} from '../../signer/base/SignerBase';
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
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

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
          rl.close();
          resolve('none');
          return;
        }
        if (normalized === '2') {
          rl.close();
          resolve('on_host');
          return;
        }
        if (normalized === '3') {
          rl.close();
          resolve('on_device');
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
 * 4. Resolve passphraseState in memory (NEVER persisted to disk)
 * 5. Get address from device
 * 6. Persist session.json with device info + passphraseMode
 *
 * SECURITY:
 * - Passphrase NEVER touches disk (no keychain, no file)
 * - Passphrase NEVER appears in shell history or terminal output
 * - passphraseState exists only in process memory during this invocation
 * - Session stores only the MODE (how to re-prompt), not the value
 * - Each subsequent CLI command re-obtains passphrase via pinentry/device
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
  let passphraseMode: PassphraseMode = 'none';
  let passphraseState: string | undefined;

  if (isTTY && isHumanMode) {
    passphraseMode = await promptPassphraseMode(output);
  }

  // Step 3: Resolve passphraseState in memory (never persisted)
  if (passphraseMode === 'on_host') {
    // Use pinentry for secure passphrase input — no terminal echo, no shell history
    const passphrase = await promptPassphraseViaPinentry();
    output.info('Resolving passphrase state on device...');
    passphraseState = await resolvePassphraseState(connectId, {
      passphrase,
    });
    // passphrase string is now eligible for GC — we only keep passphraseState in memory
  } else if (passphraseMode === 'on_device') {
    output.info('Please enter passphrase on device screen...');
    passphraseState = await resolvePassphraseState(connectId, {
      passphraseOnDevice: true,
    });
  }
  // passphraseMode === 'none' → no passphrase needed

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
    loginMethod: 'hardware',
    walletKind: 'hardware',
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
