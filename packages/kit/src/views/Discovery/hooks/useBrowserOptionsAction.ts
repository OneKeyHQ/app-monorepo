import { useCallback } from 'react';

import { Share } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

function useBrowserOptionsAction() {
  const handleShareUrl = useCallback(
    (url: string, onCloseActionList: () => void) => {
      if (!url) {
        throw new Error('url is required');
      }
      setTimeout(() => {
        onCloseActionList();
        void Share.share(
          platformEnv.isNativeIOS
            ? {
                url,
              }
            : {
                message: url,
              },
        );
      }, 100);
    },
    [],
  );

  return {
    handleShareUrl,
  };
}

export default useBrowserOptionsAction;
