import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import BigNumber from 'bignumber.js';
import { z } from 'zod';

import stringUtils from './stringUtils';

// Base units as a canonical decimal string (no sign, no leading zeros), at
// most `max`.
export function zPrivacyBaseUnits(max: string) {
  return z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .max(max.length)
    .refine((value) => new BigNumber(value).lte(max));
}

// Whole bytes of hex, at most `maxChars` characters.
export function zPrivacyHex(maxChars?: number) {
  const hex = z.string().regex(/^(?:[0-9a-fA-F]{2})+$/);
  return maxChars === undefined ? hex : hex.max(maxChars);
}

export function getPrivacyTransactionReviewDigest(params: {
  accountId: string;
  networkId: string;
  proposalHex: string;
  intent: Record<string, string | boolean>;
}): string {
  return bytesToHex(
    sha256(
      stringUtils.stableStringify({
        domain: 'privacy-payment-review-v1',
        ...params,
      }),
    ),
  );
}
