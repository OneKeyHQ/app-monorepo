import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import type { IntlShape } from 'react-intl';

// U+2212 MINUS SIGN (not a hyphen) to match the outgoing-amount style used
// across the app's transaction rows. The container owns amount formatting,
// including the zero-amount exception for degenerate no-value psbts.
export const MINUS_SIGN = '−';

// Shared between TransactionRow and BatchSigningProgress's "current
// transaction" card so both surfaces describe multi-output items the same
// way. Pure self-transfer psbts carry their owned recipient in `recipient`
// (mirroring the single-psbt confirm page), so an empty recipient only
// remains for outputs whose scripts decode to no address (e.g. OP_RETURN).
export function formatRecipientLine({
  recipient,
  extraRecipientCount,
  intl,
}: {
  recipient: string;
  extraRecipientCount: number;
  intl: Pick<IntlShape, 'formatMessage'>;
}): string {
  if (!recipient) {
    return intl.formatMessage({
      id: ETranslations.batch_psbt_to_multiple_outputs__desc,
    });
  }
  return extraRecipientCount > 0
    ? intl.formatMessage(
        {
          id: ETranslations.batch_psbt_to_address_additional_outputs__desc,
        },
        { address: recipient, count: extraRecipientCount },
      )
    : intl.formatMessage(
        { id: ETranslations.batch_psbt_to_address__desc },
        { address: recipient },
      );
}

// The wallet API delivers `price` as a number, a numeric string, or a
// no-price sentinel ('--' on signet, '0' on testnet3). A truthiness check
// lets the sentinels through and the fiat math then renders a bare 'NaN'
// (or a misleading '$0.00') under the amount, so only a finite positive
// price is usable for the fiat line; everything else means "no fiat line".
export function normalizeNativePrice(
  price: number | string | undefined,
): string | undefined {
  if (price === undefined) {
    return undefined;
  }
  const priceBn = new BigNumber(price);
  if (!priceBn.isFinite() || priceBn.lte(0)) {
    return undefined;
  }
  return priceBn.toFixed();
}

// Single decision table for whether ANY signing exit (Sign all, per-row
// drill-down, Complete-stage Done) may proceed. Keep pending explicit because
// its checkbox is hidden until a risk verdict exists. checkUrlSecurity always
// settles to a level, including Unknown on error/timeout, so this cannot lock
// the page permanently.
export function computeSignExitGate({
  origin,
  urlSecurityInfo,
  showContinueOperate,
  continueOperate,
}: {
  origin: string;
  urlSecurityInfo: IHostSecurity | undefined;
  showContinueOperate: boolean;
  continueOperate: boolean;
}): {
  isRiskCheckPending: boolean;
  isBlockingRisk: boolean;
  isRiskUnacknowledged: boolean;
  isSignExitBlocked: boolean;
} {
  // No origin → useRiskDetection never queries, so there is no verdict to
  // wait for (its empty-origin early return yields an empty info object).
  const isRiskCheckPending = !!origin && !urlSecurityInfo;
  // High stays hard-blocked even after the user ticks "Proceed at my own
  // risk" — the checkbox only unblocks Medium (and risky-method) origins.
  const isBlockingRisk = urlSecurityInfo?.level === EHostSecurityLevel.High;
  const isRiskUnacknowledged = showContinueOperate && !continueOperate;
  return {
    isRiskCheckPending,
    isBlockingRisk,
    isRiskUnacknowledged,
    isSignExitBlocked:
      isRiskCheckPending || isBlockingRisk || isRiskUnacknowledged,
  };
}
