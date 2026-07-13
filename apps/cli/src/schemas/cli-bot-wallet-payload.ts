import { cliBotWalletEncryptedCredentialSchema } from '@onekeyhq/shared/src/types/cliBotWallet';
import type { ICliBotWalletEncryptedCredential } from '@onekeyhq/shared/src/types/cliBotWallet';

import type { z } from 'zod';

const BASE64URL_32_BYTE_ID_RE = /^[A-Za-z0-9_-]{43}$/;
const MAX_SOURCE_LABEL_LENGTH = 128;
const MAX_WALLET_ID_LENGTH = 128;

export const cliBotWalletPayloadSchema: z.ZodType<ICliBotWalletEncryptedCredential> =
  cliBotWalletEncryptedCredentialSchema.superRefine((payload, ctx) => {
    if (!BASE64URL_32_BYTE_ID_RE.test(payload.keyId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['keyId'],
        message: 'keyId must be a 32-byte base64url id',
      });
    }

    if (!BASE64URL_32_BYTE_ID_RE.test(payload.accessToken)) {
      ctx.addIssue({
        code: 'custom',
        path: ['accessToken'],
        message: 'accessToken must be a 32-byte base64url id',
      });
    }

    if (payload.sourceLabel.length > MAX_SOURCE_LABEL_LENGTH) {
      ctx.addIssue({
        code: 'too_big',
        maximum: MAX_SOURCE_LABEL_LENGTH,
        type: 'string',
        inclusive: true,
        path: ['sourceLabel'],
        message: `sourceLabel must be at most ${MAX_SOURCE_LABEL_LENGTH} characters`,
      });
    }

    if (payload.walletId.length > MAX_WALLET_ID_LENGTH) {
      ctx.addIssue({
        code: 'too_big',
        maximum: MAX_WALLET_ID_LENGTH,
        type: 'string',
        inclusive: true,
        path: ['walletId'],
        message: `walletId must be at most ${MAX_WALLET_ID_LENGTH} characters`,
      });
    }
  });
