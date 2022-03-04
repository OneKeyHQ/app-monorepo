import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import { RootRoutes } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function useModalClose({ onClose }: { onClose?: () => void | boolean }) {
  const navigation = useNavigation();

  const close = useCallback(() => {
    if (!navigation.canGoBack() && platformEnv.isDesktop) {
      console.error('navigation can not go back.');
      // navigate() not working
      navigation.navigate(RootRoutes.Root);
      window.location.href = '/';
    }
    if (onClose) {
      onClose();
    }
    navigation.getParent()?.goBack?.();
  }, [navigation, onClose]);
  return close;
}

export default useModalClose;
