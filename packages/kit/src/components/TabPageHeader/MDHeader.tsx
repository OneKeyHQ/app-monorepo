import { type ReactNode, useMemo } from 'react';

import {
  GlassButtonCapsule,
  Page,
  View,
  XStack,
  isLiquidGlassAvailable,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  useActiveAccount,
  useIsAccountSelectorSyncLoading,
} from '../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { LazyMoreActionButton } from '../MoreActionButton/LazyMoreActionButton';

import { HeaderNotificationIconButton } from './components/HeaderNotificationIconButton';
import { HeaderUpdateButton } from './components/HeaderUpdateButton';
import { HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight, SelectorTrigger } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';
import { LegacyUniversalSearchInput } from './LegacyUniversalSearchInput';

import type { SharedValue } from 'react-native-reanimated';

function HomeWalletConnectionRow({
  headerPx,
  selectedHeaderTab,
  sceneName,
  tabRoute,
  customHeaderLeftItems,
}: {
  headerPx: string;
  selectedHeaderTab?: ETranslations;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderLeftItems?: ReactNode;
}) {
  const {
    activeAccount: { wallet, account },
  } = useActiveAccount({ num: 0 });
  const isSyncLoading = useIsAccountSelectorSyncLoading(0);
  const hasNoUsableWallet = accountUtils.hasNoUsableWallet({
    wallet,
    account,
  });

  if (hasNoUsableWallet && !isSyncLoading) {
    return null;
  }

  return (
    <XStack alignItems="center" px={headerPx} h={44}>
      <HeaderLeft
        selectedHeaderTab={selectedHeaderTab}
        sceneName={sceneName}
        tabRoute={tabRoute}
        customHeaderLeftItems={customHeaderLeftItems}
      />
    </XStack>
  );
}

export function MDHeader({
  tabRoute,
  sceneName,
  hideSearch,
  selectedHeaderTab,
  customHeaderLeftItems,
  customHeaderRightItems,
  renderCustomHeaderRightItems,
  headerPx = '$5',
  headerHeight = 44,
  disableHomeHeaderGlass = false,
  pageScrollPosition,
}: {
  tabRoute: ETabRoutes;
  sceneName: EAccountSelectorSceneName;
  hideSearch: boolean;
  selectedHeaderTab?: ETranslations;
  customHeaderLeftItems?: ReactNode;
  customHeaderRightItems?: ReactNode;
  renderCustomHeaderRightItems?: ({
    fixedItems,
  }: {
    fixedItems: ReactNode;
  }) => ReactNode;
  headerPx?: string;
  headerHeight?: number;
  disableHomeHeaderGlass?: boolean;
  pageScrollPosition?: SharedValue<number>;
}) {
  const { top } = useSafeAreaInsets();
  const isHomeTab =
    tabRoute === ETabRoutes.Home &&
    sceneName !== EAccountSelectorSceneName.homeUrlAccount;
  const usePlainHomeHeader = isHomeTab && disableHomeHeaderGlass;
  // Preserve the iOS 26 header spacing when its fixed Home overlay uses plain pills.
  const headerGlassActive = isLiquidGlassAvailable() && !usePlainHomeHeader;

  const rightActions = useMemo(() => {
    return sceneName === EAccountSelectorSceneName.homeUrlAccount ? (
      <XStack flexShrink={1}>
        <HomeTokenListProviderMirror>
          <SelectorTrigger />
        </HomeTokenListProviderMirror>
      </XStack>
    ) : (
      <HeaderRight
        selectedHeaderTab={selectedHeaderTab}
        sceneName={sceneName}
        tabRoute={tabRoute}
        customHeaderRightItems={customHeaderRightItems}
        renderCustomHeaderRightItems={renderCustomHeaderRightItems}
      />
    );
  }, [
    customHeaderRightItems,
    renderCustomHeaderRightItems,
    sceneName,
    selectedHeaderTab,
    tabRoute,
  ]);
  const showBaseHeader = useMemo(() => {
    return (
      tabRoute === ETabRoutes.Home ||
      tabRoute === ETabRoutes.Discovery ||
      tabRoute === ETabRoutes.Earn ||
      tabRoute === ETabRoutes.Perp ||
      tabRoute === ETabRoutes.DeviceManagement
    );
  }, [tabRoute]);
  return (
    <>
      <Page.Header headerShown={false} />
      {showBaseHeader ? (
        <>
          {isHomeTab ? (
            <>
              {/* Row 1: Search bar + notification + more */}
              <XStack
                alignItems="center"
                px={headerPx}
                h={56}
                gap={headerGlassActive || usePlainHomeHeader ? '$3' : '$6'}
                {...(top || platformEnv.isNativeAndroid
                  ? { mt: top || '$2' }
                  : {})}
              >
                <XStack flex={1}>
                  <LegacyUniversalSearchInput
                    size="medium"
                    glass={!usePlainHomeHeader}
                    tabRoute={tabRoute}
                    containerProps={{
                      width: '100%',
                      $gtLg: undefined,
                    }}
                  />
                </XStack>
                <HeaderUpdateButton />
                {/* iOS 26: the notification + menu buttons share ONE Liquid
                    Glass capsule (this in-page header hides the native nav bar,
                    so they can't get the system bar-button glass). Off iOS 26
                    this is a passthrough — the two buttons stay as before. */}
                {usePlainHomeHeader ? (
                  <XStack
                    h={40}
                    alignItems="center"
                    px="$2"
                    gap="$3"
                    bg="$bgStrong"
                    borderRadius="$full"
                  >
                    <HeaderNotificationIconButton testID="header-right-notification" />
                    <LazyMoreActionButton />
                  </XStack>
                ) : (
                  <GlassButtonCapsule>
                    <HeaderNotificationIconButton testID="header-right-notification" />
                    <LazyMoreActionButton />
                  </GlassButtonCapsule>
                )}
              </XStack>
              {/* Row 2: Wallet connection (account + network + address) */}
              <HomeWalletConnectionRow
                headerPx={headerPx}
                selectedHeaderTab={selectedHeaderTab}
                sceneName={sceneName}
                tabRoute={tabRoute}
                customHeaderLeftItems={customHeaderLeftItems}
              />
            </>
          ) : (
            <>
              <XStack
                alignItems="center"
                justifyContent="space-between"
                px={headerPx}
                h={headerHeight}
                {...(top || platformEnv.isNativeAndroid
                  ? { mt: top || '$2' }
                  : {})}
              >
                <View>
                  <HeaderLeft
                    selectedHeaderTab={selectedHeaderTab}
                    sceneName={sceneName}
                    tabRoute={tabRoute}
                    customHeaderLeftItems={customHeaderLeftItems}
                    pageScrollPosition={pageScrollPosition}
                  />
                </View>
                <View>
                  <HeaderTitle sceneName={sceneName} />
                </View>
                {rightActions}
              </XStack>

              {!hideSearch ? (
                <HeaderMDSearch tabRoute={tabRoute} sceneName={sceneName} />
              ) : null}
            </>
          )}
        </>
      ) : (
        <XStack h={top || '$2'} bg="$bgApp" />
      )}
    </>
  );
}
