import { Page, View, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HeaderLeft } from './HeaderLeft';
import { HeaderRight } from './HeaderRight';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({
  sceneName,
  showHeaderRight,
}: ITabPageHeaderProp) {
  const { top } = useSafeAreaInsets();
  return (
    <>
      <Page.Header headerShown={false} />
      <XStack
        justifyContent="space-between"
        px="$5"
        pt={top}
        mt={platformEnv.isNativeAndroid ? '$2' : undefined}
      >
        <View>
          <HeaderLeft sceneName={sceneName} />
        </View>
        {showHeaderRight ? <HeaderRight sceneName={sceneName} /> : null}
      </XStack>
    </>
  );
}
