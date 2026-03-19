import { type ReactNode, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  DebugRenderTracker,
  NavBackButton,
  Page,
  SizableText,
  XStack,
  fs,
  rootNavigationRef,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabHomeRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { getHomeTabStackLength } from '../../views/Home/pages/urlAccount/urlAccountUtils';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { WalletConnectionGroup } from './components';
import { UrlAccountPageHeader } from './urlAccountPageHeader';

import type { SharedValue } from 'react-native-reanimated';

export function HeaderLeftCloseButton() {
  return (
    <Page.Close>
      <NavBackButton />
    </Page.Close>
  );
}
const discoveryTabs = platformEnv.isNative
  ? [
      ETranslations.global_market,
      ETranslations.global_earn,
      ETranslations.global_browser,
    ]
  : [ETranslations.global_market, ETranslations.global_earn];

// Static styles for animated text to match $headingXl token
const animatedTextStyles = StyleSheet.create({
  text: {
    fontSize: fs(20),
    fontWeight: '600',
    lineHeight: fs(28),
    fontFamily: 'Roobert-SemiBold',
  },
});

function SegmentText({
  translationId,
  selected,
}: {
  translationId: (typeof discoveryTabs)[number];
  selected: boolean;
}) {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
      tab: translationId as
        | ETranslations.global_market
        | ETranslations.global_browser
        | ETranslations.global_earn,
    });
  }, [translationId]);
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <SizableText
        size="$headingXl"
        color={selected ? '$text' : '$textSubdued'}
        onPress={handlePress}
      >
        {intl.formatMessage({ id: translationId })}
      </SizableText>
    </TouchableOpacity>
  );
}

function AnimatedSegmentText({
  translationId,
  index,
  pageScrollPosition,
}: {
  translationId: (typeof discoveryTabs)[number];
  index: number;
  pageScrollPosition: SharedValue<number>;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const activeColor = theme.text.val;
  const inactiveColor = theme.textSubdued.val;

  const handlePress = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
      tab: translationId as
        | ETranslations.global_market
        | ETranslations.global_browser
        | ETranslations.global_earn,
    });
  }, [translationId]);

  const animatedColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      pageScrollPosition.value,
      [index - 1, index, index + 1],
      [inactiveColor, activeColor, inactiveColor],
    );
    return { color };
  });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.Text
        style={[animatedTextStyles.text, animatedColorStyle]}
        numberOfLines={1}
      >
        {intl.formatMessage({ id: translationId })}
      </Animated.Text>
    </TouchableOpacity>
  );
}

export function DiscoveryHeaderSegment({
  selectedHeaderTab,
  pageScrollPosition,
}: {
  selectedHeaderTab?: ETranslations;
  pageScrollPosition?: SharedValue<number>;
}) {
  if (pageScrollPosition) {
    return (
      <XStack gap="$4">
        {discoveryTabs.map((tab, index) => (
          <AnimatedSegmentText
            key={tab}
            translationId={tab}
            index={index}
            pageScrollPosition={pageScrollPosition}
          />
        ))}
      </XStack>
    );
  }

  return (
    <XStack gap="$4">
      {discoveryTabs.map((tab) => (
        <SegmentText
          key={tab}
          translationId={tab}
          selected={selectedHeaderTab === tab}
        />
      ))}
    </XStack>
  );
}

export function HeaderLeft({
  selectedHeaderTab,
  sceneName,
  tabRoute,
  customHeaderLeftItems,
  pageScrollPosition,
}: {
  selectedHeaderTab?: ETranslations;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderLeftItems?: ReactNode;
  pageScrollPosition?: SharedValue<number>;
}) {
  const { gtMd: _gtMd } = useMedia();

  const items = useMemo(() => {
    if (customHeaderLeftItems) {
      return customHeaderLeftItems;
    }

    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return (
        <XStack gap="$1.5">
          <NavBackButton
            onPress={() => {
              if (platformEnv.isWebDappMode) {
                rootNavigationRef.current?.navigate(
                  ETabRoutes.Market,
                  {
                    screen: ETabMarketRoutes.TabMarket,
                  },
                  {
                    pop: true,
                  },
                );
              } else if (
                getHomeTabStackLength() > 1 &&
                rootNavigationRef.current?.canGoBack()
              ) {
                rootNavigationRef.current?.goBack();
              } else {
                rootNavigationRef.current?.navigate(
                  ETabRoutes.Home,
                  {
                    screen: ETabHomeRoutes.TabHome,
                  },
                  {
                    pop: true,
                  },
                );
              }
            }}
          />
          {platformEnv.isNativeIOS ? <UrlAccountPageHeader /> : null}
        </XStack>
      );
    }

    if (tabRoute === ETabRoutes.Discovery) {
      return platformEnv.isNative ||
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel ? (
        <DiscoveryHeaderSegment
          selectedHeaderTab={selectedHeaderTab}
          pageScrollPosition={pageScrollPosition}
        />
      ) : null;
    }

    // For mobile and native platforms, keep the original layout
    return <WalletConnectionGroup tabRoute={tabRoute} />;
  }, [
    customHeaderLeftItems,
    sceneName,
    tabRoute,
    selectedHeaderTab,
    pageScrollPosition,
  ]);
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      <DebugRenderTracker name="TabPageHeader__HeaderLeft" position="top-right">
        {items}
      </DebugRenderTracker>
    </AccountSelectorProviderMirror>
  );
}
