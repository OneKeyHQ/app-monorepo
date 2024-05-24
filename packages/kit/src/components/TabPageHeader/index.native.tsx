import { Page, View, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';

import { HeaderLeft } from './HeaderLeft';
import { HeaderRight } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({
  sceneName,
  showHeaderRight,
}: ITabPageHeaderProp) {
  useDebugComponentRemountLog({
    name: `native TabPageHeader:${sceneName}:${String(showHeaderRight)}`,
  });
  const { top } = useSafeAreaInsets();
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
          <HeaderLeft sceneName={sceneName} />
        </View>
        <View>
          <HeaderTitle sceneName={sceneName} />
        </View>
        {showHeaderRight ? <HeaderRight sceneName={sceneName} /> : null}
      </XStack>
    </>
  );
}
