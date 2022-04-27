import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { navigationGoHomeForceReload } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function useModalClose({ onClose }: { onClose?: () => void | boolean } = {}) {
  const navigation = useNavigation();

  const close = useCallback(() => {
    if (onClose) {
      onClose();
    }
    const parent = navigation.getParent();
    // parent is undefined in global.$navigationRef
    if (parent?.canGoBack()) {
      parent?.goBack();
      return;
    }
    if (navigation?.canGoBack()) {
      navigation?.goBack();
      return;
    }
    // do not execute this code below on Modal onClose:
    //    navigation.getParent()?.goBack();
    if (!platformEnv.isExtensionUiStandaloneWindow) {
      navigationGoHomeForceReload();
    }
  }, [navigation, onClose]);
  return close;
}

export default useModalClose;
