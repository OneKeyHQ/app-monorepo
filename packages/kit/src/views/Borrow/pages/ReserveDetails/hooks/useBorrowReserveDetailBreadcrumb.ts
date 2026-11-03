import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EarnNavigation } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';

import { BorrowNavigation } from '../../../borrowUtils';

interface IUseBorrowReserveDetailBreadcrumbParams {
  symbol: string;
  provider: string;
  networkId: string;
  marketAddress: string;
  // The market's short name ("Aave Core"), once the market list is in
  marketLabel?: string;
}

// DeFi › Aave Core › cbBTC (demo 11-03): home, the reserve's own market, the
// reserve
export function useBorrowReserveDetailBreadcrumb({
  symbol,
  provider,
  networkId,
  marketAddress,
  marketLabel,
}: IUseBorrowReserveDetailBreadcrumbParams) {
  const appNavigation = useAppNavigation();
  const intl = useIntl();

  const breadcrumbProps = useMemo(
    () => ({
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_earn }),
          onClick: () => {
            void EarnNavigation.popToEarnHome(appNavigation);
          },
        },
        {
          label: marketLabel || normalizeToEarnProvider(provider) || provider,
          onClick: () => {
            BorrowNavigation.pushToBorrowHome(appNavigation, {
              provider,
              networkId,
              marketAddress,
            });
          },
        },
        { label: symbol },
      ],
    }),
    [
      appNavigation,
      intl,
      marketAddress,
      marketLabel,
      networkId,
      provider,
      symbol,
    ],
  );

  return {
    breadcrumbProps,
  };
}
