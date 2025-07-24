import { useCallback, useMemo, useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { Divider } from '../../content';
import { SizableText, XStack, YStack } from '../../primitives';

import type { IYStackProps } from '../../primitives';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';

export function TabItem({
  name,
  isFocused,
  onTabPress,
  tabItemStyle,
  focusedTabStyle,
}: {
  name: string;
  isFocused: boolean;
  onTabPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
}) {
  const handlePress = useCallback(() => {
    onTabPress(name);
  }, [name, onTabPress]);
  return (
    <YStack
      h={44}
      // minWidth={52}
      ai="center"
      jc="center"
      ml={20}
      key={name}
      onPress={handlePress}
      position="relative"
      {...tabItemStyle}
      {...(isFocused ? focusedTabStyle : undefined)}
    >
      <SizableText
        size="$bodyLgMedium"
        color={isFocused ? '$text' : '$textSubdued'}
      >
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
  tabItemStyle,
  focusedTabStyle,
}: Omit<Partial<ITabBarProps>, 'focusedTab' | 'tabNames'> & {
  focusedTab: SharedValue<string>;
  tabNames: string[];
  onTabPress: (name: string) => void;
  divider?: boolean;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
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
  const tabItems = useMemo(() => {
    return tabNames.map((name) =>
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
          tabItemStyle={tabItemStyle}
          focusedTabStyle={focusedTabStyle}
        />
      ),
    );
  }, [
    currentTab,
    focusedTabStyle,
    onTabPress,
    renderItem,
    tabItemStyle,
    tabNames,
  ]);
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
        <XStack>{tabItems}</XStack>
        {renderToolbar?.({ focusedTab: currentTab })}
      </XStack>
      {divider ? <Divider /> : null}
    </YStack>
  );
}
