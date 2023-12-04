// it's a demo
import { Divider, Text, YStack } from '@onekeyhq/components';

import useListenTabFocusState from '../hooks/useListenTabFocusState';
import { ETabRoutes } from '../routes/Tab/Routes';

export function WebTabBarItem() {
  useListenTabFocusState(ETabRoutes.WebViewTab, (isFocus: boolean) => {
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
