import { useCallback } from 'react';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { showPositionShareDialog } from '../components/PositionShare/PositionShareModal';

import type { IShareData } from '../components/PositionShare/types';

export function useShowPositionShare() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();

  const showShare = useCallback(
    (data: IShareData) => {
      if (gtMd) {
        showPositionShareDialog(data, dialogInTab);
      } else {
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.PositionShare,
          params: { data },
        });
      }
    },
    [gtMd, dialogInTab, navigation],
  );

  return { showPositionShare: showShare };
}
