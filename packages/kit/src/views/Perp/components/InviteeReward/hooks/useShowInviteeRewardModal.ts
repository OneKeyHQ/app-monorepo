import { useCallback } from 'react';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { showInviteeRewardDialog } from '../InviteeRewardContent';

export function useShowInviteeRewardModal() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();

  const showModal = useCallback(async () => {
    if (gtMd) {
      await showInviteeRewardDialog(dialogInTab);
    } else {
      navigation.pushModal(EModalRoutes.PerpModal, {
        screen: EModalPerpRoutes.PerpsInviteeRewardModal,
      });
    }
  }, [gtMd, dialogInTab, navigation]);

  return { showInviteeRewardModal: showModal };
}
