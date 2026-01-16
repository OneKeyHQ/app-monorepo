/**
 * Native Apple Sign-In service for macOS Desktop
 *
 * Uses the native apple-auth-macos module to perform Apple Sign-In
 * with system UI (no browser required).
 */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// eslint-disable-next-line import/no-relative-packages
import type { IAppleSignInResult } from '../../../native-modules/apple-auth-macos';

// Only load on macOS
const isMacOS = process.platform === 'darwin';

let appleAuthModule:
  | typeof import('../../../native-modules/apple-auth-macos')
  | null = null;

// Lazy load the native module
function getAppleAuthModule() {
  if (!isMacOS) {
    return null;
  }

  if (!appleAuthModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      appleAuthModule = require('../../native-modules/apple-auth-macos');
    } catch (error) {
      console.warn(
        'Failed to load apple-auth-macos:',
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  return appleAuthModule;
}

/**
 * Check if native Apple Sign-In is available.
 * Requires macOS 10.15+ and the native module to be built.
 */
export function isAppleAuthAvailable(): boolean {
  const module = getAppleAuthModule();
  if (!module) {
    return false;
  }

  try {
    return module.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Perform native Apple Sign-In.
 *
 * @returns Promise with identity token and nonce for Supabase
 * @throws Error if sign-in fails or user cancels
 */
export async function signInWithApple(): Promise<IAppleSignInResult> {
  const module = getAppleAuthModule();

  if (!module) {
    throw new OneKeyLocalError(
      'Apple Sign-In native module is not available. ' +
        'Make sure you are on macOS and the module is built.',
    );
  }

  if (!module.isAvailable()) {
    throw new OneKeyLocalError('Apple Sign-In requires macOS 10.15 or later');
  }

  return module.signIn();
}
