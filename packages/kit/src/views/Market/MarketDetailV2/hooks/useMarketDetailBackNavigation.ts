import { useCallback } from 'react';

import {
  CommonActions,
  useNavigation as useReactNavigation,
  useRoute,
} from '@react-navigation/native';

import { useSplitSubView } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { resolveMarketDetailBackAction } from '../../utils/marketDetailNavigation';

export function useMarketDetailBackNavigation() {
  const navigation = useAppNavigation();
  const reactNavigation = useReactNavigation();
  const route = useRoute();
  const params = route.params as { from?: EEnterWay } | undefined;
  const isTabletDetailView = useSplitSubView();

  const handleBackPress = useCallback(() => {
    const state = reactNavigation.getState();
    const action = resolveMarketDetailBackAction({
      isTabletDetailView,
      isNative: Boolean(platformEnv.isNative),
      from: params?.from,
      routes: state?.routes,
      index: state?.index,
    });

    if (action.type === 'pop') {
      navigation.pop();
      return;
    }
    if (action.type === 'popAndSwitchDiscovery') {
      navigation.pop();
      navigation.switchTab(ETabRoutes.Discovery);
      return;
    }
    if (action.type === 'popToTop') {
      navigation.popToTop();
      return;
    }

    reactNavigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: action.name }],
      }),
    );
  }, [params, reactNavigation, navigation, isTabletDetailView]);

  return { handleBackPress };
}
