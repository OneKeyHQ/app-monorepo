import { useState } from 'react';

import {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

import { Divider } from '../../content';
import { SizableText, XStack, YStack } from '../../primitives';

import { useTabsContext } from './context';

import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';

export function TabItem({
  name,
  focusedTab,
  onTabPress,
}: {
  name: string;
  focusedTab: string;
  onTabPress: (name: string) => void;
}) {
  return (
    <YStack
      h={49}
      minWidth={52}
      ai="center"
      jc="center"
      ml={20}
      key={name}
      onPress={() => onTabPress(name)}
    >
      <SizableText color={focusedTab === name ? '$text' : '$textSubdued'}>
        {name}
      </SizableText>
    </YStack>
  );
}

export function Header({
  onTabPress,
  tabNames,
  focusedTab,
}: TabBarProps<string>) {
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);
  useAnimatedReaction(
    () => focusedTab.value,
    (result, previous) => {
      if (result !== previous) {
        setCurrentTab(result);
      }
    },
  );
  return (
    <YStack
      className="onekey-tabs-header"
      position={'sticky' as any}
      top={0}
      bg="$bg"
      zIndex={10}
    >
      <XStack>
        {tabNames.map((name) => (
          <TabItem
            key={name}
            name={name}
            focusedTab={currentTab}
            onTabPress={onTabPress}
          />
        ))}
      </XStack>
      <YStack
        position="absolute"
        bottom={0}
        h="$0.5"
        bg="$text"
        borderRadius={1}
        left={20}
        width={52}
        transform={[
          {
            translateX: tabNames.findIndex((name) => name === currentTab) * 72,
          },
        ]}
      />
      <Divider />
    </YStack>
  );
}
