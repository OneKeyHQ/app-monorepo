import { useCallback } from 'react';

import {
  CommonActions,
  useNavigation as useNativeNavigation,
} from '@react-navigation/native';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabDeviceManagementRoutes } from '@onekeyhq/shared/src/routes';

export function useDeviceBackNavigation() {
  const navigation = useAppNavigation();
  const reactNavigation = useNativeNavigation();

  const handleBackPress = useCallback(() => {
    // A removal can reach the detail screen twice: once from its own
    // WalletUpdate refresh (the wallet is gone) and once from the caller that
    // finished the removal. The second call is already on the way out; popping
    // again would close the refreshed list underneath it.
    if (!reactNavigation.isFocused()) {
      return;
    }
    // Check if the previous route is DeviceDetail
    const state = reactNavigation.getState();
    if (
      state &&
      state.routes &&
      state.routes.length === 1 &&
      state.index === 0
    ) {
      const route = state.routes[0];
      if (route?.name === ETabDeviceManagementRoutes.DeviceDetail) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: ETabDeviceManagementRoutes.DeviceList }],
          }),
        );
      }
    }

    navigation.pop();
  }, [reactNavigation, navigation]);

  return { handleBackPress };
}
