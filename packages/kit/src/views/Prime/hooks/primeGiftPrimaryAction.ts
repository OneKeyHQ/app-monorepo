import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IPrimeGiftPrimaryAction = 'login' | 'verify' | 'claim' | 'close';

export function resolvePrimeGiftPrimaryAction({
  isQuerying,
  isLoggedIn,
  isPendingPaymentConfirm,
  hasClaimableCode,
  isAlreadyRedeemed,
  hasVerificationWithoutCode,
  hasError,
  giftDuration,
}: {
  isQuerying: boolean;
  isLoggedIn: boolean;
  isPendingPaymentConfirm: boolean;
  hasClaimableCode: boolean;
  isAlreadyRedeemed: boolean;
  hasVerificationWithoutCode: boolean;
  hasError: boolean;
  giftDuration?: string;
}): {
  action: IPrimeGiftPrimaryAction;
  labelId: ETranslations;
  labelValues?: { duration: string };
} {
  if (isQuerying) {
    return {
      action: 'verify',
      labelId: ETranslations.prime_gift_checking_login__desc,
    };
  }
  if (!isLoggedIn) {
    return {
      action: 'login',
      labelId: ETranslations.global_sign_in,
    };
  }
  if (isPendingPaymentConfirm && hasClaimableCode) {
    return {
      action: 'claim',
      labelId: ETranslations.prime_gift_claim_anyway__action,
    };
  }
  // Redeemed is terminal, including when verification also stored an error.
  if (isAlreadyRedeemed) {
    return { action: 'close', labelId: ETranslations.global_done };
  }
  if (hasError) {
    return hasClaimableCode
      ? { action: 'claim', labelId: ETranslations.global_retry }
      : { action: 'verify', labelId: ETranslations.global_retry };
  }
  if (hasVerificationWithoutCode) {
    return { action: 'verify', labelId: ETranslations.global_retry };
  }
  if (hasClaimableCode) {
    if (giftDuration) {
      return {
        action: 'claim',
        labelId: ETranslations.prime_gift_claim_duration__action,
        labelValues: { duration: giftDuration },
      };
    }
    return { action: 'claim', labelId: ETranslations.prime_gift__title };
  }
  return {
    action: 'verify',
    labelId: ETranslations.prime_gift_verify_device__action,
  };
}
