import { useCallback } from 'react';

import { navigationGoBack } from '@onekeyhq/kit/src/hooks/useAppNavigation';

function useModalClose({ onClose }: { onClose?: () => void | boolean }) {
  // const navigation = useNavigation();

  const close = useCallback(() => {
    if (onClose) {
      onClose();
    }
    navigationGoBack({ parentBack: true });
  }, [onClose]);
  return close;
}

export default useModalClose;
