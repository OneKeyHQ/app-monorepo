import { type ReactNode, useMemo } from 'react';

import {
  DebugRenderTracker,
  NavBackButton,
  Page,
  SizableText,
  XStack,
  rootNavigationRef,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
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

export function HeaderLeft({
  sceneName,
  tabRoute,
  customHeaderLeftItems,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderLeftItems?: ReactNode;
}) {
  const { gtMd } = useMedia();

  const items = useMemo(() => {
    const withWebNavigation = (content: ReactNode) => {
      if (!(platformEnv.isWeb && gtMd)) {
        return content;
      }
      return (
        <XStack gap="$6" ai="center">
          <WebHeaderNavigation />
          {content}
        </XStack>
      );
    };
    if (customHeaderLeftItems) {
      return customHeaderLeftItems;
    }
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return withWebNavigation(
        <XStack gap="$1.5">
          <NavBackButton
            onPress={() => {
              rootNavigationRef.current?.navigate(
                ETabRoutes.Home,
                {
                  screen: ETabHomeRoutes.TabHome,
                },
                {
                  pop: true,
                },
              );
            }}
          />
          {platformEnv.isNativeIOS ? <UrlAccountPageHeader /> : null}
        </XStack>,
      );
    }

    if (tabRoute === ETabRoutes.Discovery) {
      return withWebNavigation(
        <SizableText size="$headingLg">
          {/* {intl.formatMessage({
            id: ETranslations.global_browser,
          })} */}
        </SizableText>,
      );
    }

    if (tabRoute === ETabRoutes.WebviewPerpTrade) {
      return withWebNavigation(
        <SizableText size="$headingLg">
          {/* {intl.formatMessage({
            id: ETranslations.global_browser,
          })} */}
        </SizableText>,
      );
    }

    // For web platform, only show WebHeaderNavigation (logo + navigation)
    // Account selector will be moved to HeaderRight
    if (platformEnv.isWeb && gtMd) {
      return <WebHeaderNavigation />;
    }

    // For mobile and native platforms, keep the original layout
    return <WalletConnectionGroup tabRoute={tabRoute} />;
  }, [customHeaderLeftItems, sceneName, tabRoute, gtMd]);
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
