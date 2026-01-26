import { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { switchTab } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const shouldOpenExpandExtPerp = !!(
  platformEnv.isExtension &&
  (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel)
);

export function ExtPerp() {
  useFocusEffect(
    useCallback(() => {
      if (shouldOpenExpandExtPerp) {
        void backgroundApiProxy.serviceWebviewPerp.openExtPerpTab();
        setTimeout(() => {
          switchTab(ETabRoutes.Home);
        }, 300);
      }
    }, []),
  );
  return null;
}
