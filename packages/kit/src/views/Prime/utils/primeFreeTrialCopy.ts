import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import {
  formatPrimeFreeTrialReservationEnd,
  formatPrimeFreeTrialResetDate,
} from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import type { IPrimeFreeTrialFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import type { IntlShape } from 'react-intl';

// Feature names reuse the titles the Prime feature list already shows
// (PRIME_FEATURE_INTROS); toast titles put them in {feature}.
const FEATURE_NAME: Record<IPrimeFreeTrialFeatureId, ETranslations> = {
  [EPrimeFeatures.BulkCopyAddresses]: ETranslations.global_bulk_copy_addresses,
  [EPrimeFeatures.BulkSend]: ETranslations.wallet_bulk_send_title,
  [EPrimeFeatures.BulkRevoke]: ETranslations.global_bulk_revoke,
  [EPrimeFeatures.AddressRiskCheck]: ETranslations.address_risk_check__title,
  [EPrimeFeatures.DAppTranslate]: ETranslations.prime_ai_translate_title,
};

// A state the free trial rejects a feature in. The remaining hint and the
// toasts both read its text from getPrimeFreeTrialNoticeCopy, so they cannot
// drift apart.
export type IPrimeFreeTrialNotice =
  | { kind: 'exhausted'; resetAt?: number }
  // Used up only by live reservations of earlier uses (still running or
  // interrupted, on any device).
  | { kind: 'reservationHeld'; heldUntil: number }
  | { kind: 'notOpen' }
  // Toast only: the details of an address not checked this month; the
  // feature itself is open.
  | { kind: 'detailsNotEligible' }
  // Toast only: translate closed while a session was running.
  | { kind: 'noLongerAvailable' };

// The single source of the rejection copy:
// - toast title: "<feature> + status"
// - toast body: when it ends, if known
// - remaining hint (the page already names the feature): the status and the
//   body as one sentence
export function getPrimeFreeTrialNoticeCopy({
  intl,
  featureId,
  notice,
}: {
  intl: IntlShape;
  featureId: IPrimeFreeTrialFeatureId;
  notice: IPrimeFreeTrialNotice;
}): { toastTitle: string; toastMessage?: string; hint: string } {
  const feature = intl.formatMessage({ id: FEATURE_NAME[featureId] });
  switch (notice.kind) {
    case 'exhausted': {
      const date = formatPrimeFreeTrialResetDate(notice.resetAt);
      return {
        // Translate is metered in tokens, every other feature in uses.
        toastTitle: intl.formatMessage(
          {
            id:
              featureId === EPrimeFeatures.DAppTranslate
                ? ETranslations.prime_free_trial_quota_used_up__title
                : ETranslations.prime_free_trial_no_uses_left__title,
          },
          { feature },
        ),
        toastMessage: date
          ? intl.formatMessage(
              { id: ETranslations.prime_free_trial_resets__desc },
              { date },
            )
          : undefined,
        // Translate shows no remaining hint, so the hint is always in uses.
        hint: intl.formatMessage(
          {
            id: date
              ? ETranslations.prime_free_trial_no_uses_left_resets__desc
              : ETranslations.prime_free_trial_no_uses_left__desc,
          },
          { date },
        ),
      };
    }
    case 'reservationHeld': {
      const time = formatPrimeFreeTrialReservationEnd(notice.heldUntil);
      return {
        toastTitle: intl.formatMessage(
          { id: ETranslations.prime_free_trial_use_in_progress__title },
          { feature },
        ),
        // The uses come back only if that use did not succeed.
        toastMessage: time
          ? intl.formatMessage(
              {
                id: ETranslations.prime_free_trial_returns_if_interrupted__desc,
              },
              { time },
            )
          : undefined,
        hint: intl.formatMessage(
          {
            id: time
              ? ETranslations.prime_free_trial_use_in_progress_returns__desc
              : ETranslations.prime_free_trial_use_in_progress__desc,
          },
          { time },
        ),
      };
    }
    case 'notOpen':
      return {
        toastTitle: intl.formatMessage(
          { id: ETranslations.prime_free_trial_unavailable__title },
          { feature },
        ),
        hint: intl.formatMessage({
          id: ETranslations.prime_free_trial_unavailable__desc,
        }),
      };
    case 'detailsNotEligible': {
      const text = intl.formatMessage({
        id: ETranslations.prime_free_trial_details_checked_this_month__title,
      });
      return { toastTitle: text, hint: text };
    }
    case 'noLongerAvailable': {
      const text = intl.formatMessage(
        { id: ETranslations.prime_free_trial_ended__title },
        { feature },
      );
      return { toastTitle: text, hint: text };
    }
    default:
      return notice satisfies never;
  }
}
