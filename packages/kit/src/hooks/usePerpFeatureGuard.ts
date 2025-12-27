import { useCallback, useEffect } from 'react';

import { useFocusEffect } from '@react-navigation/native';

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

  useEffect(() => {
    if (perpDisabled) {
      navigation.switchTab(ETabRoutes.Home);
    }
  }, [navigation, perpDisabled]);

  return !perpDisabled;
}
