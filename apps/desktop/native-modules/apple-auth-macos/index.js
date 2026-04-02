/**
 * Native Apple Sign-In for macOS Electron apps
 *
 * Usage:
 *   const appleAuth = require('apple-auth-macos');
 *
 *   if (appleAuth.isAvailable()) {
 *     const result = await appleAuth.signIn();
 *     console.log(result.identityToken); // JWT to send to Supabase
 *   }
 */

// Only load native module on macOS
const isMacOS = process.platform === 'darwin';

let nativeModule = null;

if (isMacOS) {
  try {
    // Try to load the native module
    // In development: from build/Release/
    // In production: from the app bundle
    nativeModule = require('./build/Release/apple_auth.node');
  } catch (error) {
    console.warn(
      'Failed to load apple-auth-macos native module:',
      error.message,
    );
  }
}

/**
 * Check if Apple Sign-In is available.
 * @returns {boolean} True if available (macOS 10.15+)
 */
function isAvailable() {
  if (!isMacOS || !nativeModule) {
    return false;
  }
  try {
    return nativeModule.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Perform Apple Sign-In.
 * @returns {Promise<{
 *   identityToken: string,
 *   authorizationCode?: string,
 *   user: string,
 *   email?: string,
 *   fullName?: string,
 *   rawNonce: string
 * }>}
 * @throws {Error} If sign-in fails or is cancelled
 */
async function signIn() {
  if (!isMacOS) {
    throw new Error('Apple Sign-In is only available on macOS');
  }
  if (!nativeModule) {
    throw new Error('Apple Sign-In native module not loaded');
  }
  if (!isAvailable()) {
    throw new Error('Apple Sign-In requires macOS 10.15 or later');
  }

  return nativeModule.signIn();
}

module.exports = {
  isAvailable,
  signIn,
};
