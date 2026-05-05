import { useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useDeviceManagerModalStyle = () => {
  const { gtMd } = useMedia();

  const isModalStack = useMemo(() => {
    const automaticAdaptation =
      platformEnv.isDesktop ||
      platformEnv.isWebDappMode ||
      (platformEnv.isExtension &&
        !platformEnv.isExtensionUiPopup &&
        !platformEnv.isExtensionUiSidePanel) ||
      (platformEnv.isWeb && !platformEnv.isExtension);

    if (!gtMd && automaticAdaptation) {
      return true;
    }

    return (
      platformEnv.isNative ||
      platformEnv.isExtensionUiPopup ||
      platformEnv.isExtensionUiSidePanel
    );
  }, [gtMd]);

  return {
    isModalStack,
  };
};
