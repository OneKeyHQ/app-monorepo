import { useFocusEffect } from '@react-navigation/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

export function shouldOpenExpandExtPerp() {
  return (
    platformEnv.isExtension &&
    (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel)
  );
}

export function ExtPerp() {
  const navigation = useAppNavigation();
  useFocusEffect(() => {
    if (shouldOpenExpandExtPerp()) {
      void backgroundApiProxy.serviceWebviewPerp.openExtPerpTab();
      setTimeout(() => {
        navigation.navigate(ETabRoutes.Home);
        // window.close();
      }, 300);
    }
  });
  return null;
}
