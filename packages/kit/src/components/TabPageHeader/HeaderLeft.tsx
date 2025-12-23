import { type ReactNode, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  DebugRenderTracker,
  NavBackButton,
  Page,
  SizableText,
  Stack,
  XStack,
  rootNavigationRef,
  useMedia,
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

import { AccountSelectorProviderMirror } from '../AccountSelector';

import { WalletConnectionGroup, WebHeaderNavigation } from './components';
import { UrlAccountPageHeader } from './urlAccountPageHeader';

export function HeaderLeftCloseButton() {
  return (
    <Page.Close>
      <NavBackButton />
    </Page.Close>
  );
}
const discoveryTabs = [
  ETranslations.global_market,
  ETranslations.global_earn,
  ETranslations.global_browser,
];

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

export function DiscoveryHeaderSegment({
  selectedHeaderTab,
}: {
  selectedHeaderTab?: ETranslations;
}) {
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
}: {
  selectedHeaderTab?: ETranslations;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderLeftItems?: ReactNode;
}) {
  const { gtMd } = useMedia();

  const items = useMemo(() => {
    const withWebNavigation = (content: ReactNode) => {
      if (platformEnv.isWebDappMode && gtMd) {
        return (
          <XStack gap="$6" ai="center">
            <WebHeaderNavigation />
            {content}
          </XStack>
        );
      }

      return content;
    };

    if (customHeaderLeftItems) {
      if (tabRoute === ETabRoutes.WebviewPerpTrade) {
        return withWebNavigation(customHeaderLeftItems);
      }
      return customHeaderLeftItems;
    }

    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      if (platformEnv.isWebDappMode && gtMd) {
        return withWebNavigation(null);
      }

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
      return platformEnv.isNative ? (
        <DiscoveryHeaderSegment selectedHeaderTab={selectedHeaderTab} />
      ) : null;
    }

    // For web platform, only show WebHeaderNavigation (logo + navigation)
    // Account selector will be moved to HeaderRight
    if (platformEnv.isWebDappMode && gtMd) {
      return <WebHeaderNavigation />;
    }

    // For mobile and native platforms, keep the original layout
    return <WalletConnectionGroup tabRoute={tabRoute} />;
  }, [customHeaderLeftItems, sceneName, tabRoute, gtMd, selectedHeaderTab]);
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
