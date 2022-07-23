/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RootRoutes } from '../routes/routesEnum';

// TODO make navigation proxy: parent.goBack self.goBack
export function getAppNavigation() {
  // useNavigation() not working for OverlayContainer/Portal Component
  return global.$navigationRef.current!;
}

// TODO rename useRootNavigation, rootNavigation parent is null
export default function useAppNavigation() {
  const navigation = useNavigation();
  return getAppNavigation() ?? navigation;
}

export function useNavigationGoHomeForceReload() {
  const navigation = useAppNavigation();
  return useCallback(() => {
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
  }, [navigation]);
}

export function useNavigationBack() {
  const navigationRef = useAppNavigation();
  const fallback = useNavigationGoHomeForceReload();
  return useCallback(() => {
    if (navigationRef?.canGoBack?.()) {
      navigationRef?.goBack();
    } else {
      fallback();
    }
  }, [navigationRef, fallback]);
}
