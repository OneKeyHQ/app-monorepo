import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { Tabs } from '@onekeyhq/components';
import type { ITabBarItemProps } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { EExportTab } from '@onekeyhq/shared/src/referralCode/type';

interface IRewardTypeTabsProps {
  earnLabel: string;
  perpsLabel: string;
  earnContent: ReactNode;
  perpsContent: ReactNode;
  initialTab?: EExportTab;
  onTabChange?: (tab: EExportTab) => void;
}

export function RewardTypeTabs({
  earnLabel,
  perpsLabel,
  earnContent,
  perpsContent,
  initialTab = EExportTab.Earn,
  onTabChange,
}: IRewardTypeTabsProps) {
  const labelMap = useMemo(
    () => ({
      [EExportTab.Earn]: earnLabel,
      [EExportTab.Perp]: perpsLabel,
    }),
    [earnLabel, perpsLabel],
  );

  const renderTabItem = useCallback(
    (props: ITabBarItemProps, _index: number) => (
      <Tabs.TabBarItem
        key={props.name}
        {...props}
        name={labelMap[props.name as EExportTab] ?? props.name}
        onPress={() => props.onPress(props.name)}
      />
    ),
    [labelMap],
  );

  const handleTabChange = useCallback(
    ({ tabName }: { tabName: string }) => {
      const nextTab =
        tabName === EExportTab.Perp ? EExportTab.Perp : EExportTab.Earn;
      onTabChange?.(nextTab);
    },
    [onTabChange],
  );

  return (
    <Tabs.Container
      initialTabName={initialTab}
      onTabChange={handleTabChange}
      renderTabBar={(props) => (
        <Tabs.TabBar {...props} renderItem={renderTabItem} />
      )}
    >
      <Tabs.Tab name={EExportTab.Earn}>{earnContent}</Tabs.Tab>
      <Tabs.Tab name={EExportTab.Perp}>{perpsContent}</Tabs.Tab>
    </Tabs.Container>
  );
}
