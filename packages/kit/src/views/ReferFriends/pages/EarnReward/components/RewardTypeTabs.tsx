import type { ReactNode } from 'react';

import { Tabs } from '@onekeyhq/components';

interface IRewardTypeTabsProps {
  earnLabel: string;
  perpsLabel: string;
  earnContent: ReactNode;
  perpsContent: ReactNode;
}

export function RewardTypeTabs({
  earnLabel,
  perpsLabel,
  earnContent,
  perpsContent,
}: IRewardTypeTabsProps) {
  return (
    <Tabs.Container renderTabBar={(props) => <Tabs.TabBar {...props} />}>
      <Tabs.Tab name={earnLabel}>{earnContent}</Tabs.Tab>
      <Tabs.Tab name={perpsLabel}>{perpsContent}</Tabs.Tab>
    </Tabs.Container>
  );
}
