import { z } from 'zod';

/**
 * Payload describing a BotWallet exported to OneKey CLI under the
 * "remote key protection" scheme. Embedded in
 * `IPersistAuthSessionInput.privateData.cliBotWalletEncryptedCredential` and
 * shipped to the CLI through App Transfer.
 *
 * Trust boundary (project-context.md §2):
 * - `ciphertextBase64` is the AES-256-GCM ciphertext of the serialized
 *   `IBip39RevealableSeed`. The 32B random encryption key is **registered
 *   with the Bot Wallet key API** (not embedded here) and only handed back to
 *   the CLI on access-token-authorized fetch.
 * - The legacy `privateData.decryptedCredentials` path **must NOT** be filled
 *   alongside this payload (FR7).
 *
 * `displayAddress` is intentionally NOT part of the wire format: the receiver
 * (CLI) must derive the first EVM address itself from the decrypted seed, so
 * that no sender-supplied identity claim ever reaches user-facing output.
 * `walletId` stays in the payload because it is a deterministic function of
 * `(parent keyless wallet id, index)` and serves only as an identifier — not
 * a chain identity claim.
 */
export type ICliBotWalletEncryptedCredential = {
  version: 1;
  walletId: string;
  ciphertextBase64: string;
  keyId: string;
  accessToken: string;
  sourceLabel: string;
  algorithm: 'aes-256-gcm';
};

export type ICliBotWalletRevealableSeed = {
  entropyWithLangPrefixed: string;
  seed: string;
};

export type ILegacyDefaultPayload = {
  encryptedMnemonic: string;
  encryptionKey: string;
  session: {
    displayAddress: string;
    sourceLabel: string;
  };
};

export type IPersistAuthSessionInput =
  | {
      kind: 'cli-bot-wallet';
      payload: ICliBotWalletEncryptedCredential;
    }
  | {
      kind: 'legacy-default';
      payload: ILegacyDefaultPayload;
    };

const nonEmptyString = z.string().min(1);
const base64UrlToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const base64Blob = z.string().refine(
  (value) => {
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value,
      )
    ) {
      return false;
    }
    let padding = 0;
    if (value.endsWith('==')) {
      padding = 2;
    } else if (value.endsWith('=')) {
      padding = 1;
    }
    const decodedLength = (value.length / 4) * 3 - padding;
    return decodedLength >= 28; // nonce(12B) + auth tag(16B)
  },
  { message: 'Invalid AES-GCM ciphertext base64 blob' },
);

/**
 * Zod schema enforcing the payload shape at runtime. `version` and
 * `algorithm` are pinned to literal values (not enums) so that any future
 * schema bump is forced to update both the TS literal type and this schema.
 */
export const cliBotWalletEncryptedCredentialSchema: z.ZodType<ICliBotWalletEncryptedCredential> =
  z
    .object({
      version: z.literal(1),
      walletId: nonEmptyString,
      ciphertextBase64: base64Blob,
      keyId: base64UrlToken,
      accessToken: base64UrlToken,
      sourceLabel: nonEmptyString,
      algorithm: z.literal('aes-256-gcm'),
    })
    .strict();
