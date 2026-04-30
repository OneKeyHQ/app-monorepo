import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { showPerpPortfolioDialog } from '../components/Portfolio/PerpPortfolioModal';

export function useShowPortfolio() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const intl = useIntl();

  const showPortfolio = useCallback(() => {
    if (gtMd) {
      showPerpPortfolioDialog(dialogInTab, intl);
    } else {
      navigation.pushModal(EModalRoutes.PerpModal, {
        screen: EModalPerpRoutes.MobilePortfolioPage,
      });
    }
  }, [gtMd, dialogInTab, navigation, intl]);

  return { showPortfolio };
}
