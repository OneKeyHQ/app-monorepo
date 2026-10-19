import { useCallback, useEffect, useMemo } from 'react';

import { useSharedValue } from 'react-native-reanimated';

import { Tabs } from '@onekeyhq/components';
import type { ITabBarItemProps } from '@onekeyhq/components';

/**
 * The selector's tab rows on the shared `Tabs.TabBar` — the bar universal
 * search uses — keyed by tab id instead of by label.
 */
export function SelectorTabBar<T extends string>({
  tabs,
  value,
  onChange,
  testIDPrefix,
  backgroundColor = '$bg',
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (tabId: T) => void;
  testIDPrefix: string;
  backgroundColor?: '$bg' | '$bgApp';
}) {
  const containerStyle = useMemo(
    () => ({ bg: backgroundColor }),
    [backgroundColor],
  );
  const tabNames = useMemo(() => tabs.map((tab) => tab.label), [tabs]);
  const focusedLabel =
    tabs.find((tab) => tab.id === value)?.label ?? tabNames[0] ?? '';
  const focusedTab = useSharedValue(focusedLabel);
  useEffect(() => {
    focusedTab.value = focusedLabel;
  }, [focusedLabel, focusedTab]);

  const handleTabPress = useCallback(
    (label: string) => {
      const tab = tabs.find((item) => item.label === label);
      if (tab) {
        onChange(tab.id);
      }
    },
    [onChange, tabs],
  );
  const renderItem = useCallback(
    (props: ITabBarItemProps, index: number) => (
      <Tabs.TabBarItem
        {...props}
        // The bar drops focus updates that land within 300ms of a tab press,
        // so a reset right after one (e.g. a new query back to All) would
        // leave its own highlight behind; the controlled value decides.
        isFocused={props.name === focusedLabel}
        testID={`${testIDPrefix}${tabs[index]?.id ?? ''}`}
      />
    ),
    [focusedLabel, tabs, testIDPrefix],
  );

  return (
    <Tabs.TabBar
      scrollable
      tabNames={tabNames}
      focusedTab={focusedTab}
      onTabPress={handleTabPress}
      renderItem={renderItem}
      containerStyle={containerStyle}
    />
  );
}
