import { useMemo } from 'react';

import { Page, View, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';

import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

import { HeaderLeft } from './HeaderLeft';
import { HeaderRight } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({ sceneName, tabRoute }: ITabPageHeaderProp) {
  const { top } = useSafeAreaInsets();

  const headerRight = useMemo(() => {
    return (
      <HomeTokenListProviderMirror>
        <HeaderRight sceneName={sceneName} tabRoute={tabRoute} />
      </HomeTokenListProviderMirror>
    );
  }, [sceneName, tabRoute]);
  return (
    <>
      <Page.Header headerShown={false} />
      <XStack
        alignItems="center"
        justifyContent="space-between"
        px="$5"
        pt={top}
        mt={platformEnv.isNativeAndroid ? '$2' : undefined}
      >
        <View>
          <HeaderLeft sceneName={sceneName} tabRoute={tabRoute} />
        </View>
        <View>
          <HeaderTitle sceneName={sceneName} />
        </View>
        {headerRight}
      </XStack>
    </>
  );
}
