import { useCallback, useEffect } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/native';

import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import useAppNavigation from './useAppNavigation';
import { usePerpTabConfig } from './usePerpTabConfig';

export function usePerpFeatureGuard() {
  useFocusEffect(
    useCallback(() => {
      void backgroundApiProxy.serviceHyperliquid.updatePerpsConfigByServer();
    }, []),
  );

  const navigation = useAppNavigation();
  const { perpDisabled } = usePerpTabConfig();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (perpDisabled && isFocused) {
      navigation.switchTab(ETabRoutes.Home);
    }
  }, [navigation, perpDisabled, isFocused]);

  return !perpDisabled;
}

export function useNativePerpFeatureGuard() {
  const canRender = usePerpFeatureGuard();
  const { perpTabShowWeb } = usePerpTabConfig();

  return canRender && !perpTabShowWeb;
}
