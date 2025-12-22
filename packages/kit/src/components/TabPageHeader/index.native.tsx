import { useMemo } from 'react';

import { Page, View, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

import { HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({
  sceneName,
  tabRoute,
  customHeaderRightItems,
  selectedHeaderTab,
  renderCustomHeaderRightItems,
  customHeaderLeftItems,
  hideSearch = false,
}: ITabPageHeaderProp) {
  const { top } = useSafeAreaInsets();

  const headerRight = useMemo(() => {
    return (
      <HomeTokenListProviderMirror>
        <HeaderRight
          selectedHeaderTab={selectedHeaderTab}
          sceneName={sceneName}
          tabRoute={tabRoute}
          customHeaderRightItems={customHeaderRightItems}
          renderCustomHeaderRightItems={renderCustomHeaderRightItems}
        />
      </HomeTokenListProviderMirror>
    );
  }, [
    selectedHeaderTab,
    sceneName,
    tabRoute,
    customHeaderRightItems,
    renderCustomHeaderRightItems,
  ]);

  return (
    <>
      <Page.Header headerShown={false} />
      {tabRoute === ETabRoutes.Home || tabRoute === ETabRoutes.Discovery ? (
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
            {headerRight}
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
