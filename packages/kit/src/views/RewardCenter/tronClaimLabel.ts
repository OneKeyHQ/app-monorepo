import { ETranslations } from '@onekeyhq/shared/src/locale';

export function getTronClaimLabel(claimed: boolean, exhausted: boolean) {
  if (claimed) return ETranslations.wallet_subsidy_claimed;
  if (exhausted) return ETranslations.wallet_subsidy_all_used;
  return ETranslations.wallet_subsidy_claim;
}
