import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useNavigationGoHomeForceReload } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function useModalClose({
  onClose,
  fallbackToHome = true,
}: { onClose?: () => void | boolean; fallbackToHome?: boolean } = {}) {
  const navigation = useNavigation();
  const fallback = useNavigationGoHomeForceReload();

  const close = useCallback(() => {
    if (onClose) {
      onClose();
    }

    // ** only pop current screen
    // if (navigation?.canGoBack?.()) {
    //   navigation?.goBack?.();
    //   return;
    // }

    // ** close Modal should close full stack screens
    const parent = navigation.getParent();
    // parent is undefined in global.$navigationRef
    if (parent?.canGoBack?.()) {
      parent?.goBack();
      return;
    }
    if (navigation?.canGoBack?.()) {
      navigation?.goBack();
      return;
    }
    // do not execute this code below on Modal onClose:
    //    navigation.getParent()?.goBack();
    if (!platformEnv.isExtensionUiStandaloneWindow && fallbackToHome) {
      fallback();
    }
  }, [navigation, onClose, fallback, fallbackToHome]);
  return close;
}

export default useModalClose;
