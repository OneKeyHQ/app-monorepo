import { useCallback } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

export function useShowGuide() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();

  const showGuide = useCallback(() => {
    if (!gtMd) {
      navigation.pushModal(EModalRoutes.PerpModal, {
        screen: EModalPerpRoutes.PerpGuidePage,
      });
    }
  }, [gtMd, navigation]);

  return { showGuide };
}
