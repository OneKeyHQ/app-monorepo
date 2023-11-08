// it's a demo
import { YStack } from 'tamagui';

import { Divider, Text } from '@onekeyhq/components';
import useListenTabFocusState from '@onekeyhq/components/src/hooks/useListenTabFocusState';

import { TabRoutes } from '../routes/Root/Tab/Routes';

export function WebTabBarItem() {
  useListenTabFocusState(TabRoutes.WebViewTab, (isFocus: boolean) => {
    console.log('isFocus: ', isFocus);
  });
  return (
    <YStack flex={1}>
      <Divider marginVertical="$2" />
      <YStack space="$2">
        <Text onPress={() => console.log('Hello Onekey 1')}>Oneke Item 1</Text>
        <Text onPress={() => console.log('Hello Onekey 2')}>Oneke Item 2</Text>
        <Text onPress={() => console.log('Hello Onekey 3')}>Oneke Item 3</Text>
        <Text onPress={() => console.log('Hello Onekey 4')}>Oneke Item 4</Text>
        <Text onPress={() => console.log('Hello Onekey 5')}>Oneke Item 5</Text>
      </YStack>
    </YStack>
  );
}
