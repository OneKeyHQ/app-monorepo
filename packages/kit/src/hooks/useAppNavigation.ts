/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RootRoutes } from '../routes/routesEnum';

import type { RootNavContainerRef } from '../provider/NavigationProvider';

// TODO make navigation proxy: parent.goBack self.goBack
export function getAppNavigation(): RootNavContainerRef {
  // useNavigation() not working for OverlayContainer/Portal Component
  // @typescript-eslint/no-non-null-asserted-optional-chain
  const navigation = global.$navigationRef?.current;
  return navigation!;
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
      navigation.navigate(RootRoutes.Main);
      if (
        platformEnv.isWeb ||
        platformEnv.isExtensionUiExpandTab ||
        (platformEnv.isDesktop && platformEnv.isDev)
      ) {
        window.location.href = '/';
        return;
      }
      window.location.href = '#/';
      // standalone window reload will cause approve promise fail
      if (!platformEnv.isExtensionUiStandaloneWindow) {
        window.location.reload();
      }
    } else {
      navigation.navigate(RootRoutes.Main);
    }
  }, [navigation]);
}

export function useNavigationBack({
  fallback,
}: { fallback?: () => void } = {}) {
  const navigationRef = useAppNavigation();
  const reloadFullPage = useNavigationGoHomeForceReload();
  return useCallback(() => {
    if (navigationRef?.canGoBack?.()) {
      navigationRef?.goBack();
    } else if (fallback) {
      fallback();
    } else {
      reloadFullPage();
    }
  }, [navigationRef, fallback, reloadFullPage]);
}
