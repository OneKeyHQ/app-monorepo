import { cryptoBridge } from './crypto-bridge';

/**
 * Generate a 32-byte CSPRNG identifier encoded as base64url. Used for both
 * `keyId` and the plaintext `accessToken` (the latter is only ever returned
 * once and then sha256-hashed for storage — see `auth.ts`).
 */
export function generateBase64UrlId(): string {
  return cryptoBridge.randomBytes(32).toString('base64url');
}
