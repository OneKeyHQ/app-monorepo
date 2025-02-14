import { useCallback } from 'react';

import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { EModalDeviceManagementRoutes } from '@onekeyhq/shared/src/routes/deviceManagement';

export function useBuyOneKeyHeaderRightButton(
  params?:
    | {
        inDeviceManagementStack?: boolean;
      }
    | undefined,
) {
  const navigation = useAppNavigation();

  const toOneKeyHardwareWalletPage = useCallback(() => {
    if (params?.inDeviceManagementStack) {
      navigation.push(EModalDeviceManagementRoutes.BuyOneKeyHardwareWallet);
    } else {
      navigation.push(EOnboardingPages.OneKeyHardwareWallet);
    }
  }, [params?.inDeviceManagementStack, navigation]);

  return {
    headerRight: () => (
      <HeaderIconButton
        icon="QuestionmarkOutline"
        onPress={toOneKeyHardwareWalletPage}
      />
    ),
    toOneKeyHardwareWalletPage,
  };
}
