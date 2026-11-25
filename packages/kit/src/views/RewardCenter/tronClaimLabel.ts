import { ETranslations } from '@onekeyhq/shared/src/locale';

export function getTronClaimLabel(claimed: boolean, exhausted: boolean) {
  if (claimed) return ETranslations.subsidy_claimed__title;
  if (exhausted) return ETranslations.wallet_subsidy_all_used;
  return ETranslations.subsidy_claim__action;
}
