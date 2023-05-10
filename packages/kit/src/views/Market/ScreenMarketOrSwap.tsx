import { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import {
  Box,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TabRoutes } from '../../routes/routesEnum';
import { PortalEntry, PortalExit } from '../Overlay/RootPortal';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import MarketList from './MarketList';
import { SharedMobileTab } from './SharedMobileTab';
import { sharedMobileTabRef } from './sharedMobileTabRef';

import type { MarketTopTabName } from '../../store/reducers/market';

export function ScreenMarketOrSwap({
  routeName,
}: {
  routeName: MarketTopTabName;
}) {
  const { top } = useSafeAreaInsets();
  const isVerticalLayout = useIsVerticalLayout();
  useFocusEffect(
    useCallback(() => {
      if (isVerticalLayout && platformEnv.isNativeAndroid) {
        sharedMobileTabRef.update(
          <PortalEntry target={`${routeName}-portal`}>
            <SharedMobileTab routeName={routeName} />
          </PortalEntry>,
        );
      }
    }, [routeName, isVerticalLayout]),
  );

  return (
    <Box flex={1} mt={`${top}px`}>
      {isVerticalLayout && platformEnv.isNativeAndroid ? (
        <PortalExit key={`${routeName}-portal`} name={`${routeName}-portal`} />
      ) : (
        <>
          <MarketHeader marketTopTabName={routeName} />
          {routeName === TabRoutes.Swap ? (
            <Swap hideBottomTabBar />
          ) : (
            <MarketList />
          )}
        </>
      )}
    </Box>
  );
}
