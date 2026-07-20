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
import { MoreActionButton } from '../MoreActionButton';

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
  pageScrollPosition?: SharedValue<number>;
}) {
  const { top } = useSafeAreaInsets();
  // iOS 26 only: when the search bar + buttons render as Liquid Glass capsules,
  // tighten the gap between them. Off iOS 26 this is false, so the row keeps its
  // original "$6" spacing (no change on other platforms / iOS < 26).
  const headerGlassActive = isLiquidGlassAvailable();

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
  const isHomeTab =
    tabRoute === ETabRoutes.Home &&
    sceneName !== EAccountSelectorSceneName.homeUrlAccount;

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
                gap={headerGlassActive ? '$3' : '$6'}
                {...(top || platformEnv.isNativeAndroid
                  ? { mt: top || '$2' }
                  : {})}
              >
                <XStack flex={1}>
                  <LegacyUniversalSearchInput
                    size="medium"
                    glass
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
                <GlassButtonCapsule>
                  <HeaderNotificationIconButton testID="header-right-notification" />
                  <MoreActionButton />
                </GlassButtonCapsule>
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
                h={44}
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
