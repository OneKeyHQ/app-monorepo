import { useCallback } from 'react';

import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

export function HistoryIconButton() {
  const navigation = useAppNavigation();
  const isTravelMode =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
    'travel-mode';

  const handlePress = useCallback(() => {
    if (isTravelMode) {
      return;
    }
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.HistoryListModal,
    });
  }, [isTravelMode, navigation]);

  return (
    <HeaderIconButton
      icon="ClockTimeHistoryOutline"
      titlePlacement="bottom"
      onPress={handlePress}
      disabled={isTravelMode}
      testID="browser-history-button"
    />
  );
}
