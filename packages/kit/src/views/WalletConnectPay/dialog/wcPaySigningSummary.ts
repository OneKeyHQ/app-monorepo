import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { sanitizeWcPayDisplayText } from '../hooks/wcPayInlineUtils';

import type { IWcPayInlineSigningSummary } from '../hooks/wcPayInlineUtils';
import type { IntlShape } from 'react-intl';

// The two lines the sheet shows while a headless signature is being produced:
// what the user is committing to, and what it costs beyond the amount already
// on screen. Both are built here — one i18n site, one testable unit — and both
// are pure: the caller hands in its intl, so they need no render harness.

const LAMPORTS_PER_SOL_DECIMALS = 9;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

// A registry symbol interpolated into trusted consent copy: long enough for
// every legitimate ticker, short enough that a padded scam symbol cannot
// smuggle a sentence into the headline.
const APPROVE_SYMBOL_MAX_CHARS = 12;

/**
 * The headline is split on `kind` rather than shared, because each signature
 * commits to a different thing: a Permit2 payload authorizes a spender to
 * pull the amount later, the Solana leg signs the transfer itself —
 * irreversible once submitted, not an allowance — an approve grants Permit2
 * the standing allowance the later permit draws on, and a personal_sign
 * commits to a message whose content is the summary itself.
 */
export function describeWcPaySigningHeadline(
  summary: IWcPayInlineSigningSummary,
  amountText: string,
  intl: IntlShape,
): string {
  switch (summary.kind) {
    case 'typedData':
      return intl.formatMessage(
        { id: ETranslations.wc_pay_authorize_amount__title },
        { amount: amountText },
      );
    case 'personalSign':
      return intl.formatMessage({
        id: ETranslations.wc_pay_sign_message_for_merchant__title,
      });
    case 'approve':
      // The symbol is server/registry-derived and lands inside trusted
      // consent copy — sanitized and bounded so a crafted symbol cannot
      // reorder or extend the headline (the personal_sign gate's rule).
      return intl.formatMessage(
        { id: ETranslations.wc_pay_allow_permit2__title },
        {
          token: sanitizeWcPayDisplayText(
            summary.summary.symbol,
            APPROVE_SYMBOL_MAX_CHARS,
          ),
        },
      );
    case 'solana':
      return intl.formatMessage(
        { id: ETranslations.wc_pay_sign_amount_payment__title },
        { amount: amountText },
      );
    default: {
      // compile-time exhaustiveness: a new signing kind must choose its own
      // headline rather than silently inherit the Solana spend wording
      const unhandled: never = summary;
      throw new OneKeyLocalError(
        `Unhandled signing summary: ${String(unhandled)}`,
      );
    }
  }
}

/**
 * How much longer the permit stays valid, always relative: the validator
 * refuses a deadline further out than WC_PAY_PERMIT_MAX_DEADLINE_S (30
 * days), so an absolute timestamp would only add a timezone the reader has
 * to convert. The days unit exists because multi-week server-issued
 * deadlines are the common inline case — "672 h" is not a duration anyone
 * parses.
 *
 * All units are FLOORED — the text may never claim more validity than the
 * signature actually has. The non-finite branch is totality, not a defense:
 * `deadlineSec` is produced in-process from a regex-validated uint, so it
 * cannot arrive as NaN today; the branch keeps the function total if that
 * ever changes, rather than rendering "Expires in NaN min".
 */
function describeWcPayPermitExpiry({
  deadlineSec,
  nowMs,
  intl,
}: {
  deadlineSec: number;
  nowMs: number;
  intl: IntlShape;
}): string | undefined {
  if (!Number.isFinite(deadlineSec)) {
    return undefined;
  }
  const remainingSec = deadlineSec - nowMs / 1000;
  if (remainingSec <= 0) {
    return intl.formatMessage({ id: ETranslations.limit_order_expired });
  }
  if (remainingSec < SECONDS_PER_MINUTE) {
    return intl.formatMessage({
      id: ETranslations.wc_pay_expires_under_minute__value,
    });
  }
  if (remainingSec < SECONDS_PER_HOUR) {
    return intl.formatMessage(
      { id: ETranslations.wc_pay_expires_in_minutes__value },
      { count: Math.floor(remainingSec / SECONDS_PER_MINUTE) },
    );
  }
  if (remainingSec < SECONDS_PER_DAY) {
    return intl.formatMessage(
      { id: ETranslations.wc_pay_expires_in_hours__value },
      { count: Math.floor(remainingSec / SECONDS_PER_HOUR) },
    );
  }
  return intl.formatMessage(
    { id: ETranslations.wc_pay_expires_in_days__value },
    { count: Math.floor(remainingSec / SECONDS_PER_DAY) },
  );
}

export function describeWcPaySigningSummary(
  summary: IWcPayInlineSigningSummary,
  intl: IntlShape,
  nowMs: number = Date.now(),
): string {
  if (summary.kind === 'personalSign') {
    // The message IS the disclosure: the gate guaranteed displayable text,
    // so it is rendered verbatim rather than described.
    return summary.summary.text;
  }
  if (summary.kind === 'approve') {
    return intl.formatMessage({
      id: summary.summary.unlimited
        ? ETranslations.wc_pay_one_time_setup_unlimited__desc
        : ETranslations.wc_pay_one_time_setup__desc,
    });
  }
  if (summary.kind === 'typedData') {
    // A permit hands a named spender a standing pull of the amount, so the
    // spender and how long it lasts are the two facts the amount alone does
    // not carry.
    const parts = [
      `${intl.formatMessage({
        id: ETranslations.wallet_bulk_send_approval_spender,
      })} ${accountUtils.shortenAddress({
        address: summary.summary.spender,
        minLength: 12,
        leadingLength: 6,
        trailingLength: 4,
      })}`,
    ];
    const expiry = describeWcPayPermitExpiry({
      deadlineSec: summary.summary.deadlineSec,
      nowMs,
      intl,
    });
    if (expiry) {
      parts.push(expiry);
    }
    return parts.join(' · ');
  }
  // Solana: the validator bounds the priority fee (<= 0.01 SOL) and at most
  // one recipient token-account rent; both are costs beyond the amount when
  // THE USER pays them, so they are named only then — a sponsored fee is
  // the merchant's cost and is disclosed as such instead.
  const parts: string[] = [];
  const fee = new BigNumber(summary.summary.priorityFeeLamports);
  if (summary.summary.sponsoredFee) {
    parts.push(
      intl.formatMessage({
        id: ETranslations.wc_pay_fee_covered_by_merchant__desc,
      }),
    );
  } else if (fee.isFinite() && fee.isGreaterThan(0)) {
    // isFinite() is load-bearing beyond the NaN case: it is what stops an
    // 'Infinity' fee from rendering as "up to Infinity SOL".
    parts.push(
      intl.formatMessage(
        { id: ETranslations.wc_pay_priority_fee_up_to__desc },
        { fee: fee.shiftedBy(-LAMPORTS_PER_SOL_DECIMALS).toFixed() },
      ),
    );
  }
  if (summary.summary.fundsRecipientAta) {
    // No figure on purpose: the standard ATA rent is ~0.002 SOL, but a
    // Token-2022 mint with extensions needs a larger account and costs
    // more, and the validator cannot bound it offline — a hardcoded number
    // would understate the real charge.
    parts.push(
      intl.formatMessage({
        id: ETranslations.wc_pay_creates_token_account__desc,
      }),
    );
  }
  return parts.length > 0
    ? parts.join(' · ')
    : intl.formatMessage({ id: ETranslations.wc_pay_signs_payment_tx__desc });
}
