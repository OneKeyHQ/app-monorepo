import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import type { IPortfolioChartType } from '../components/Portfolio/portfolioStats';

export function useShowPortfolio({
  initialChartType,
}: {
  initialChartType?: IPortfolioChartType;
} = {}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const intl = useIntl();

  const showPortfolio = useCallback(async () => {
    if (gtMd) {
      const { showPerpPortfolioDialog } =
        await import('../components/Portfolio/PerpPortfolioModal');
      showPerpPortfolioDialog(dialogInTab, intl, { initialChartType });
    } else {
      navigation.pushModal(EModalRoutes.PerpModal, {
        screen: EModalPerpRoutes.MobilePortfolioPage,
        params: { initialChartType },
      });
    }
  }, [dialogInTab, gtMd, initialChartType, intl, navigation]);

  return { showPortfolio };
}
