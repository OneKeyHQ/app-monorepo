import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import { navigationGoHomeForceReload } from '@onekeyhq/kit/src/hooks/useAppNavigation';

function useModalClose({ onClose }: { onClose?: () => void | boolean }) {
  const navigation = useNavigation();

  const close = useCallback(() => {
    if (onClose) {
      onClose();
    }
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent?.goBack();
    } else {
      navigationGoHomeForceReload();
    }
  }, [navigation, onClose]);
  return close;
}

export default useModalClose;
