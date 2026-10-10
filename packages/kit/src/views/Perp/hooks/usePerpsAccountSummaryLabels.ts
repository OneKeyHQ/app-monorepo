import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { isPerpsAccountAddressMatched } from '../utils/accountScopedData';

export function usePerpsAccountSummaryLabels() {
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [abstractionMode] = usePerpsAbstractionModeAtom();
  const mode = isPerpsAccountAddressMatched({
    activeAccountAddress: activeAccount.accountAddress,
    dataAccountAddress: abstractionMode?.accountAddress,
  })
    ? abstractionMode?.mode
    : undefined;

  switch (mode) {
    case EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT:
      return {
        title: ETranslations.perp_unified_account_summary__title,
        ratio: ETranslations.perp_unified_account_ratio__title,
      };
    case EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN:
      return {
        title: ETranslations.perp_portfolio_margin_summary__title,
        ratio: ETranslations.perp_portfolio_margin_ratio__title,
      };
    default:
      return {
        title: ETranslations.perp_trade_account_overview,
        ratio: ETranslations.perp_account_cross_margin_ration,
      };
  }
}
