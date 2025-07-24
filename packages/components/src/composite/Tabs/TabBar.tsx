import { useCallback, useMemo, useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { Divider } from '../../content';
import { SizableText, XStack, YStack } from '../../primitives';

import type { IYStackProps } from '../../primitives';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';

export function TabBarItem({
  name,
  isFocused,
  onPress,
  tabItemStyle,
  focusedTabStyle,
}: {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
}) {
  const handlePress = useCallback(() => {
    onPress(name);
  }, [name, onPress]);
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
  renderItem?: (
    props: {
      name: string;
      isFocused: boolean;
      onPress: (name: string) => void;
      tabItemStyle?: IYStackProps;
      focusedTabStyle?: IYStackProps;
    },
    index: number,
  ) => React.ReactNode;
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
    return tabNames.map((name, index) =>
      renderItem ? (
        renderItem(
          {
            name,
            isFocused: currentTab === name,
            onPress: onTabPress,
            tabItemStyle,
            focusedTabStyle,
          },
          index,
        )
      ) : (
        <TabBarItem
          key={name}
          name={name}
          isFocused={currentTab === name}
          onPress={onTabPress}
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
