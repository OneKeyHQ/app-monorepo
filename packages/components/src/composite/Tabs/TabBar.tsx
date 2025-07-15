import { useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { Divider } from '../../content';
import { SizableText, XStack, YStack } from '../../primitives';

import type { TabBarProps } from 'react-native-collapsible-tab-view';

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

export interface ITabBarProps extends TabBarProps<string> {
  renderToolbar?: ({ focusedTab }: { focusedTab: string }) => React.ReactNode;
}

export function TabBar({
  onTabPress,
  tabNames,
  focusedTab,
  renderToolbar,
}: ITabBarProps) {
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);
  useAnimatedReaction(
    () => focusedTab.value,
    (result, previous) => {
      if (result !== previous) {
        runOnJS(setCurrentTab)(result);
      }
    },
  );
  return (
    <YStack
      bg="$bgApp"
      className="onekey-tabs-header"
      position={'sticky' as any}
      top={0}
      zIndex={10}
    >
      <XStack ai="center" jc="space-between">
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
        {renderToolbar?.({ focusedTab: currentTab })}
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
