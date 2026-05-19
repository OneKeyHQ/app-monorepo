import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { IPerpsDepositWithdrawActionType } from '@onekeyhq/shared/types/hyperliquid/routes';

import { showDepositWithdrawDialog } from '../components/TradingPanel/modals/DepositWithdrawModal';

export function useShowDepositWithdrawModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
      if (gtMd) {
        if (actionType === 'deposit') {
          navigation.pushModal(EModalRoutes.PerpModal, {
            screen: EModalPerpRoutes.PerpPortfolioModal,
          });
        } else {
          await showDepositWithdrawDialog(
            {
              actionType,
            },
            dialogInTab,
            actionType === 'withdraw'
              ? intl.formatMessage({ id: ETranslations.perp_trade_withdraw })
              : undefined,
          );
        }
      } else {
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.MobileDepositWithdrawModal,
          params: { actionType },
        });
      }
    },
    [gtMd, dialogInTab, navigation, intl],
  );

  return { showDepositWithdrawModal: showModal };
}
