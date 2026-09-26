import { ETranslations } from '@onekeyhq/shared/src/locale';

import { resolvePrimeGiftPrimaryAction } from './primeGiftPrimaryAction';

const idle = {
  isQuerying: false,
  isLoggedIn: true,
  isPendingPaymentConfirm: false,
  hasClaimableCode: false,
  isAlreadyRedeemed: false,
  hasVerificationWithoutCode: false,
  hasError: false,
  giftDuration: '6 months',
};

describe('resolvePrimeGiftPrimaryAction', () => {
  it('verifies before a code exists and claims after one does', () => {
    expect(resolvePrimeGiftPrimaryAction(idle)).toEqual({
      action: 'verify',
      labelId: ETranslations.prime_gift_verify_device__action,
    });
    expect(
      resolvePrimeGiftPrimaryAction({ ...idle, hasClaimableCode: true }),
    ).toEqual({
      action: 'claim',
      labelId: ETranslations.prime_gift_claim_duration__action,
      labelValues: { duration: '6 months' },
    });
  });

  it('retries claim only when a code is already available', () => {
    expect(
      resolvePrimeGiftPrimaryAction({
        ...idle,
        hasClaimableCode: true,
        hasError: true,
      }),
    ).toEqual({ action: 'claim', labelId: ETranslations.global_retry });
    expect(resolvePrimeGiftPrimaryAction({ ...idle, hasError: true })).toEqual({
      action: 'verify',
      labelId: ETranslations.global_retry,
    });
    expect(
      resolvePrimeGiftPrimaryAction({
        ...idle,
        hasVerificationWithoutCode: true,
      }),
    ).toEqual({ action: 'verify', labelId: ETranslations.global_retry });
  });

  it('switches the claim button to claim anyway while a payment is pending', () => {
    expect(
      resolvePrimeGiftPrimaryAction({
        ...idle,
        hasClaimableCode: true,
        isPendingPaymentConfirm: true,
      }),
    ).toEqual({
      action: 'claim',
      labelId: ETranslations.prime_gift_claim_anyway__action,
    });
  });
});
