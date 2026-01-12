import { type ReactNode, useMemo } from 'react';

import { Page, View, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

import { HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight, SelectorTrigger } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

export function MDHeader({
  tabRoute,
  sceneName,
  hideSearch,
  selectedHeaderTab,
  customHeaderLeftItems,
  customHeaderRightItems,
  renderCustomHeaderRightItems,
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
  return (
    <>
      <Page.Header headerShown={false} />
      {showBaseHeader ? (
        <>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            px="$5"
            h="$11"
            {...(top || platformEnv.isNativeAndroid ? { mt: top || '$2' } : {})}
          >
            <View>
              <HeaderLeft
                selectedHeaderTab={selectedHeaderTab}
                sceneName={sceneName}
                tabRoute={tabRoute}
                customHeaderLeftItems={customHeaderLeftItems}
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
      ) : (
        <XStack h={top || '$2'} bg="$bgApp" />
      )}
    </>
  );
}
