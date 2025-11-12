import { type ReactNode, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  NavBackButton,
  Page,
  SizableText,
  XStack,
  rootNavigationRef,
  useMedia,
} from '@onekeyhq/components';
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
const discoveryTabs = [ETranslations.global_browser, ETranslations.global_earn];

function SegmentText({
  translationId,
  selected,
  setSelectedTab,
}: {
  translationId: (typeof discoveryTabs)[number];
  selected: boolean;
  setSelectedTab?: (tab: ETranslations) => void;
}) {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    setSelectedTab?.(translationId);
  }, [setSelectedTab, translationId]);
  return (
    <SizableText
      size="$headingLg"
      color={selected ? '$text' : '$textDisabled'}
      onPress={handlePress}
    >
      {intl.formatMessage({ id: translationId })}
    </SizableText>
  );
}

function DiscoveryHeaderSegment({
  selectedHeaderTab,
  onSelectHeaderTab,
}: {
  selectedHeaderTab?: ETranslations;
  onSelectHeaderTab?: (tab: ETranslations) => void;
}) {
  return (
    <XStack gap="$5">
      {discoveryTabs.map((tab) => (
        <SegmentText
          key={tab}
          translationId={tab}
          selected={selectedHeaderTab === tab}
          setSelectedTab={onSelectHeaderTab}
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
  onSelectHeaderTab,
}: {
  selectedHeaderTab?: ETranslations;
  onSelectHeaderTab?: (tab: ETranslations) => void;
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
        <DiscoveryHeaderSegment
          selectedHeaderTab={selectedHeaderTab}
          onSelectHeaderTab={onSelectHeaderTab}
        />
      ) : null;
    }

    if (tabRoute === ETabRoutes.WebviewPerpTrade) {
      return (
        <SizableText size="$headingLg">
          {/* {intl.formatMessage({
            id: ETranslations.global_browser,
          })} */}
        </SizableText>
      );
    }

    // For web platform, only show WebHeaderNavigation (logo + navigation)
    // Account selector will be moved to HeaderRight
    if (platformEnv.isWebDappMode && gtMd) {
      return <WebHeaderNavigation />;
    }

    // For mobile and native platforms, keep the original layout
    return <WalletConnectionGroup tabRoute={tabRoute} />;
  }, [
    customHeaderLeftItems,
    sceneName,
    tabRoute,
    gtMd,
    selectedHeaderTab,
    onSelectHeaderTab,
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
