import { useMemo } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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

  const breadcrumbProps = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      {
        label: 'Borrow', // intl.formatMessage({ id: ETranslations.global_borrow }),
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
  }, [symbol, appNavigation]);

  return {
    breadcrumbProps,
  };
}
