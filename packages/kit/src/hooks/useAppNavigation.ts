/* eslint-disable @typescript-eslint/no-non-null-assertion */

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RootRoutes } from '../routes/routesEnum';

// TODO make navigation proxy: parent.goBack self.goBack

export function getAppNavigation() {
  // useNavigation() not working for OverlayContainer/Portal Component
  return global.$navigationRef.current!;
}

// TODO rename useRootNavigation, rootNavigation parent is null
export default function useAppNavigation() {
  return getAppNavigation();
}

export function navigationGoHomeForceReload() {
  const navigation = getAppNavigation();
  if (platformEnv.isRuntimeBrowser && !platformEnv.isExtensionBackground) {
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

/**
 * - rootNavigation / selfNavigation
 * - goBack in self
 * - goBack in parent
 * - goBack to home
 * - goBack to home with reload
 */
export function navigationGoBack() {
  const navigation = getAppNavigation();
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigationGoHomeForceReload();
  }
}
