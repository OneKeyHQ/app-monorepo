// it's a demo
import { YStack } from 'tamagui';

import { Divider, Text } from '@onekeyhq/components';

export function WebTabBarItem() {
  return (
    <YStack flex={1}>
      <Divider marginVertical="$2" />
      <Text onPress={() => console.log('Hello Onekey')}>Hello Onekey</Text>
    </YStack>
  );
}
