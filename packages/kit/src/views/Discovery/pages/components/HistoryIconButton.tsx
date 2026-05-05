import { useCallback } from 'react';

import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function HistoryIconButton() {
  const navigation = useAppNavigation();

  const handlePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.HistoryListModal,
    });
  }, [navigation]);

  return (
    <HeaderIconButton
      icon="ClockTimeHistoryOutline"
      titlePlacement="bottom"
      onPress={handlePress}
      testID="browser-history-button"
    />
  );
}
