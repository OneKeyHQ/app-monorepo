import { type ReactNode, useMemo } from 'react';

import { Page, View, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { MoreActionButton } from '../MoreActionButton';

import { HeaderNotificationIconButton } from './components/HeaderNotificationIconButton';
import { HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight, SelectorTrigger } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';
import { LegacyUniversalSearchInput } from './LegacyUniversalSearchInput';

import type { SharedValue } from 'react-native-reanimated';

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
                gap="$6"
                {...(top || platformEnv.isNativeAndroid
                  ? { mt: top || '$2' }
                  : {})}
              >
                <XStack flex={1}>
                  <LegacyUniversalSearchInput
                    size="medium"
                    containerProps={{
                      width: '100%',
                      $gtLg: undefined,
                    }}
                  />
                </XStack>
                <HeaderNotificationIconButton testID="header-right-notification" />
                <MoreActionButton />
              </XStack>
              {/* Row 2: Wallet connection (account + network + address) */}
              <XStack alignItems="center" px={headerPx} h={44}>
                <HeaderLeft
                  selectedHeaderTab={selectedHeaderTab}
                  sceneName={sceneName}
                  tabRoute={tabRoute}
                  customHeaderLeftItems={customHeaderLeftItems}
                />
              </XStack>
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
