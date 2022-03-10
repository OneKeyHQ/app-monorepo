import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import { RootRoutes } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function useModalClose({ onClose }: { onClose?: () => void | boolean }) {
  const navigation = useNavigation();

  const close = useCallback(() => {
    if (
      !navigation.canGoBack() &&
      (platformEnv.isDesktop || platformEnv.isExtension)
    ) {
      console.error('navigation can not go back.');
      // navigate() not working
      navigation.navigate(RootRoutes.Root);
      window.location.href = '#/';
      // standalone window reload will cause approve promise fail
      if (!platformEnv.isExtensionUiStandaloneWindow) {
        window.location.reload();
      }
    }
    if (onClose) {
      onClose();
    }
    navigation.getParent()?.goBack?.();
  }, [navigation, onClose]);
  return close;
}

export default useModalClose;
