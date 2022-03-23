/* eslint-disable @typescript-eslint/no-non-null-assertion */

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RootRoutes } from '../routes/routesEnum';

export function getAppNavigation() {
  // useNavigation() not working for OverlayContainer/Portal Component
  return global.$navigationRef.current!;
}

export default function useAppNavigation() {
  return getAppNavigation();
}

export function navigationGoHomeForceReload() {
  const navigation = getAppNavigation();
  if (platformEnv.isBrowser && !platformEnv.isExtensionBackground) {
    // navigate() not working
    navigation.navigate(RootRoutes.Root);
    window.location.href = '#/';
    // standalone window reload will cause approve promise fail
    if (!platformEnv.isExtensionUiStandaloneWindow) {
      window.location.reload();
    }
  } else {
    navigation.navigate(RootRoutes.Root);
  }
}

export function navigationGoBack() {
  const navigation = getAppNavigation();
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigationGoHomeForceReload();
  }
}
