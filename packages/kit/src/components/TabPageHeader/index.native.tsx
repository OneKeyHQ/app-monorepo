import { Page, View, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HeaderRight } from './HeaderRight';
import { HeaderLeft } from './HedaerLeft';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({ sceneName }: ITabPageHeaderProp) {
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
        <HeaderRight />
      </XStack>
    </>
  );
}
