import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialUsageFeatureId,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

// Free-trial copy is hard-coded English for now (no i18n keys yet). Keep every
// string here so the later i18n migration only has to replace this file.
// Each feature has its own complete sentence (no feature-name interpolation)
// so each one maps to a single translation key later.
export const PRIME_FREE_TRIAL_COPY = {
  remainingUses(count: number) {
    return count === 1
      ? '1 free use left this month'
      : `${count} free uses left this month`;
  },
  exhaustedTitle: {
    [EPrimeFeatures.BulkCopyAddresses]:
      'Bulk copy addresses: no free uses left this month',
    [EPrimeFeatures.BulkSend]: 'Bulk send: no free uses left this month',
    [EPrimeFeatures.BulkRevoke]: 'Bulk revoke: no free uses left this month',
    [EPrimeFeatures.AddressRiskCheck]:
      'Address risk check: no free uses left this month',
    [EPrimeFeatures.DAppTranslate]: 'No free AI translation left this month',
  } satisfies Record<IPrimeFreeTrialFeatureId, string>,
  resetsOn(date: string) {
    return `Resets on ${date}.`;
  },
  // The quota is only held by a reservation of an earlier use (still running
  // or interrupted), not used up.
  reservationHeldTitle: {
    [EPrimeFeatures.BulkCopyAddresses]:
      'Bulk copy addresses: previous use not finished',
    [EPrimeFeatures.BulkSend]: 'Bulk send: previous use not finished',
    [EPrimeFeatures.BulkRevoke]: 'Bulk revoke: previous use not finished',
  } satisfies Record<IPrimeFreeTrialUsageFeatureId, string>,
  reservationHeldMessage(time: string) {
    return `If it was interrupted, your free use will be back by ${time}.`;
  },
  translateNoLongerAvailableTitle:
    'AI translation free trial is no longer available',
  getPrime: 'Get Prime',
};
