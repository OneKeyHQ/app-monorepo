import { cliBotWalletEncryptedCredentialSchema } from '../../types/cliBotWallet';

import {
  encryptCredential as defaultEncryptCredential,
  secureWipe as defaultSecureWipe,
} from './encrypt';
import {
  registerKey as defaultRegisterKey,
  revokeKey as defaultRevokeKey,
} from './register';

import type {
  ICliBotWalletEncryptedCredential,
  ICliBotWalletRevealableSeed,
} from '../../types/cliBotWallet';

export type IExportBotWalletToCliInput = {
  walletId: string;
  sourceLabel: string;
};

export type IExportBotWalletToCliDeps = {
  /** Backend boundary: turn a walletId into a usable in-memory seed. */
  getRevealableSeed: (walletId: string) => Promise<ICliBotWalletRevealableSeed>;
  /** Injected by tests; defaults to the shared util. */
  encryptCredential?: typeof defaultEncryptCredential;
  /** Injected by tests; defaults to the shared util. */
  registerKey?: typeof defaultRegisterKey;
  /** Injected by tests; defaults to the shared util. */
  revokeKey?: typeof defaultRevokeKey;
  /** Injected by tests; defaults to the shared util. */
  secureWipe?: typeof defaultSecureWipe;
  /** Runs inside the post-register rollback scope. */
  onPayloadReady?: (
    payload: ICliBotWalletEncryptedCredential,
  ) => Promise<void> | void;
  /** Forwarded to register/revoke for non-default base URLs. */
  baseUrl?: string;
};

/**
 * Single-shot flow: encrypt one BotWallet's seed, register the random key
 * with the local key service, return the `ICliBotWalletEncryptedCredential`
 * payload that will be embedded in the CLI's `IPersistAuthSessionInput`.
 *
 * Failure semantics (FR5, project-context.md §2):
 * - encrypt fails -> throw, no service interaction (no key to revoke)
 * - register fails -> throw the underlying error, no key was issued so nothing
 *   to revoke
 * - any failure AFTER `registerKey` succeeded (payload assembly, validation,
 *   App Transfer send, etc.) -> best-effort `revokeKey` to avoid orphan keys,
 *   then re-throw
 *
 * The legacy `privateData.decryptedCredentials` field is **never written** by
 * this function; callers should embed only the returned payload. Product export
 * flows must deliver it through App Transfer, not Base64/QR/manual CLI import.
 */
export async function exportBotWalletToCli(
  input: IExportBotWalletToCliInput,
  deps: IExportBotWalletToCliDeps,
): Promise<ICliBotWalletEncryptedCredential> {
  const encrypt = deps.encryptCredential ?? defaultEncryptCredential;
  const register = deps.registerKey ?? defaultRegisterKey;
  const revoke = deps.revokeKey ?? defaultRevokeKey;
  const wipe = deps.secureWipe ?? defaultSecureWipe;
  const clientOptions = { baseUrl: deps.baseUrl };

  const seed = await deps.getRevealableSeed(input.walletId);

  // 1. Encrypt locally: produces { ciphertextBase64, randomKey }.
  // No key is registered yet; if encrypt throws, there is nothing to revoke.
  const encrypted = encrypt(seed);

  let credentials: { keyId: string; accessToken: string };
  try {
    // 2. Register the random key with the local key service.
    credentials = await register(
      encrypted.randomKey.toString('base64'),
      clientOptions,
    );
  } catch (e) {
    // Registration failed: no keyId was issued, no revoke possible.
    wipe(encrypted.randomKey);
    throw e;
  }

  // 3. Assemble and hand off the payload.
  let payload: ICliBotWalletEncryptedCredential;
  try {
    payload = {
      version: 1,
      walletId: input.walletId,
      ciphertextBase64: encrypted.ciphertextBase64,
      keyId: credentials.keyId,
      accessToken: credentials.accessToken,
      sourceLabel: input.sourceLabel,
      algorithm: 'aes-256-gcm',
    };
    // Runtime schema validation catches type drift at the boundary.
    cliBotWalletEncryptedCredentialSchema.parse(payload);
    await deps.onPayloadReady?.(payload);
  } catch (e) {
    // Best-effort rollback: the key is registered but the payload was not
    // delivered successfully.
    await revoke(credentials.keyId, credentials.accessToken, clientOptions);
    wipe(encrypted.randomKey);
    throw e;
  }

  // 4. Wipe the in-memory random key; only the service holds it now.
  wipe(encrypted.randomKey);

  return payload;
}
