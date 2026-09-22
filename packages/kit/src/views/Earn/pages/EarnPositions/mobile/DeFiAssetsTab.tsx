import { useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import { groupInvestmentsByProvider } from './myPortfolio.utils';
import { ProtocolGroupRow } from './ProtocolGroupRow';

export function DeFiAssetsTab({
  investments,
  pendingCountByProvider,
  onManage,
}: {
  investments: IEarnPortfolioInvestment[];
  pendingCountByProvider: Record<string, number>;
  onManage: (investment: IEarnPortfolioInvestment) => void;
}) {
  const groups = useMemo(
    () => groupInvestmentsByProvider(investments),
    [investments],
  );
  return (
    <YStack gap="$4" py="$2">
      {groups.map((group, index) => (
        <ProtocolGroupRow
          key={group.key}
          group={group}
          pendingCount={pendingCountByProvider[group.providerCode] ?? 0}
          // the first provider opens by default so the page never lands on a
          // wall of collapsed rows
          defaultExpanded={index === 0}
          onManage={onManage}
        />
      ))}
    </YStack>
  );
}
