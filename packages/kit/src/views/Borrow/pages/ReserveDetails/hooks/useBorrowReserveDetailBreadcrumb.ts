import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

interface IUseBorrowReserveDetailBreadcrumbParams {
  symbol: string;
  provider?: string;
}

export function useBorrowReserveDetailBreadcrumb({
  symbol,
  provider: _provider,
}: IUseBorrowReserveDetailBreadcrumbParams) {
  const appNavigation = useAppNavigation();
  const intl = useIntl();

  const breadcrumbProps = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      {
        label: intl.formatMessage({ id: ETranslations.global_borrow }),
        onClick: () => {
          appNavigation.navigate(ETabRoutes.Earn, {
            screen: ETabEarnRoutes.EarnHome,
            params: { mode: 'borrow' },
          });
        },
      },
    ];

    // For now, just add symbol as the second level
    // TODO: Add protocol list check if needed in the future
    items.push({ label: symbol });

    return { items };
  }, [symbol, appNavigation, intl]);

  return {
    breadcrumbProps,
  };
}
