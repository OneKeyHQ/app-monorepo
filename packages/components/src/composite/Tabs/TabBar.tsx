import { useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { Divider } from '../../content';
import { SizableText, XStack, YStack } from '../../primitives';

import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';

export function TabItem({
  name,
  isFocused,
  onTabPress,
}: {
  name: string;
  isFocused: boolean;
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
      position="relative"
    >
      <SizableText color={isFocused ? '$text' : '$textSubdued'}>
        {name}
      </SizableText>
      {isFocused ? (
        <YStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="$0.5"
          bg="$text"
          borderRadius={1}
        />
      ) : null}
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
  renderItem,
  divider = true,
}: Omit<Partial<ITabBarProps>, 'focusedTab' | 'tabNames'> & {
  focusedTab: SharedValue<string>;
  tabNames: string[];
  onTabPress: (name: string) => void;
  divider?: boolean;
  renderItem?: ({
    name,
    isFocused,
  }: {
    name: string;
    isFocused: boolean;
  }) => React.ReactNode;
}) {
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
      userSelect="none"
      cursor="pointer"
      bg="$bgApp"
      className="onekey-tabs-header"
      position={'sticky' as any}
      top={0}
      zIndex={10}
    >
      <XStack ai="center" jc="space-between">
        <XStack>
          {tabNames.map((name) =>
            renderItem ? (
              <XStack key={name} onPress={() => onTabPress(name)}>
                {renderItem({ name, isFocused: currentTab === name })}
              </XStack>
            ) : (
              <TabItem
                key={name}
                name={name}
                isFocused={currentTab === name}
                onTabPress={onTabPress}
              />
            ),
          )}
        </XStack>
        {renderToolbar?.({ focusedTab: currentTab })}
      </XStack>
      {divider ? <Divider /> : null}
    </YStack>
  );
}
