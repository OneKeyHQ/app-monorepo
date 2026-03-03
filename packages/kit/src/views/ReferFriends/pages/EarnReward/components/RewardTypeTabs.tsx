import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { Tabs } from '@onekeyhq/components';
import type { ITabBarItemProps } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { EExportTab } from '@onekeyhq/shared/src/referralCode/type';

interface IRewardTypeTabsProps {
  earnLabel: string;
  earnContent: ReactNode;
}

export function RewardTypeTabs({
  earnLabel,
  earnContent,
}: IRewardTypeTabsProps) {
  const renderTabItem = useCallback(
    (props: ITabBarItemProps, _index: number) => (
      <Tabs.TabBarItem
        key={props.name}
        {...props}
        name={props.name === EExportTab.Earn ? earnLabel : props.name}
        onPress={() => props.onPress(props.name)}
      />
    ),
    [earnLabel],
  );

  return (
    <Tabs.Container
      initialTabName={EExportTab.Earn}
      renderTabBar={(props) => (
        <Tabs.TabBar {...props} renderItem={renderTabItem} />
      )}
    >
      <Tabs.Tab name={EExportTab.Earn}>{earnContent}</Tabs.Tab>
    </Tabs.Container>
  );
}
