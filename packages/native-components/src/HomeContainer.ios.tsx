import { type ReactNode, memo, useMemo } from 'react';

import { StyleSheet, View, type ViewProps } from 'react-native';
import { callback, getHostComponent } from 'react-native-nitro-modules';

import HomeContainerConfig from '../nitrogen/generated/shared/json/HomeContainerConfig.json';

import HomeContainerVisualSurfaceNativeComponent from './HomeContainerVisualSurfaceNativeComponent';

import type {
  IHomeContainerNativeMethods,
  IHomeContainerNativeProps,
  INativeHomeHeaderViewModel,
  INativeHomeIntent,
  INativeHomeNavigationViewModel,
  INativeHomeOwnerToken,
  INativeHomeSpotTokensViewModel,
  INativeHomeThemeViewModel,
} from './HomeContainer.nitro';

export interface IHomeContainerProps extends ViewProps {
  protocolVersion: number;
  owner: INativeHomeOwnerToken;
  navigation: INativeHomeNavigationViewModel;
  header: INativeHomeHeaderViewModel;
  spotTokens: INativeHomeSpotTokensViewModel;
  theme: INativeHomeThemeViewModel;
  walletBanner?: ReactNode;
  portfolioEmpty?: ReactNode;
  onIntent: (intent: INativeHomeIntent) => void;
}

const styles = StyleSheet.create({
  engine: {
    ...StyleSheet.absoluteFillObject,
  },
  walletBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 90,
  },
  portfolioEmpty: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 228,
  },
});

const HomeContainerHost = getHostComponent<
  IHomeContainerNativeProps,
  IHomeContainerNativeMethods
>('HomeContainer', () => HomeContainerConfig);

function HomeContainerView({
  protocolVersion,
  owner,
  navigation,
  header,
  spotTokens,
  theme,
  walletBanner,
  portfolioEmpty,
  onIntent,
  ...viewProps
}: IHomeContainerProps) {
  const wrappedIntent = useMemo(() => callback(onIntent), [onIntent]);
  return (
    <HomeContainerVisualSurfaceNativeComponent
      {...viewProps}
      ownerScopeKey={owner.scopeKey}
      ownerSessionId={owner.sessionId}
    >
      <HomeContainerHost
        style={styles.engine}
        protocolVersion={protocolVersion}
        owner={owner}
        navigation={navigation}
        header={header}
        spotTokens={spotTokens}
        theme={theme}
        onIntent={wrappedIntent}
      />
      <View
        collapsable={false}
        nativeID="onekey-home-wallet-banner-slot"
        pointerEvents="box-none"
        style={styles.walletBanner}
      >
        {walletBanner}
      </View>
      <View
        collapsable={false}
        nativeID="onekey-home-portfolio-empty-slot"
        pointerEvents="none"
        style={styles.portfolioEmpty}
      >
        {portfolioEmpty}
      </View>
    </HomeContainerVisualSurfaceNativeComponent>
  );
}

export const HomeContainer = memo(HomeContainerView);
