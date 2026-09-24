import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import { useGroupExpansion } from './GroupRow';
import { groupInvestmentsByProvider } from './myPortfolio.utils';
import { ProtocolGroupRow } from './ProtocolGroupRow';

import type { IPositionManageHandler } from './myPortfolio.utils';

export function DeFiAssetsTab({
  investments,
  isLoading,
  pendingCountByProvider,
  networkFilter,
  onManage,
}: {
  investments: IEarnPortfolioInvestment[];
  isLoading: boolean;
  pendingCountByProvider: Record<string, number>;
  /** the page's network chip; sits right under the tabs on this tab */
  networkFilter: React.ReactNode;
  onManage: IPositionManageHandler;
}) {
  const intl = useIntl();
  const groups = useMemo(
    () => groupInvestmentsByProvider(investments),
    [investments],
  );
  const { isExpanded, toggle } = useGroupExpansion();

  let placeholder: React.ReactNode = null;
  if (groups.length === 0) {
    placeholder = isLoading ? (
      <Stack ai="center" py="$8">
        <Spinner size="large" />
      </Stack>
    ) : (
      // Product: same illustration and title as the existing page, without
      // its subtitle (earn_no_orders_desc repeats the title).
      <Empty
        illustration="BlockPercentage"
        title={intl.formatMessage({
          id: ETranslations.earn_no_assets_deposited,
        })}
      />
    );
  }

  return (
    <YStack gap="$4" pb="$2">
      <Stack px="$5" pt="$3" ai="flex-start">
        {networkFilter}
      </Stack>
      {placeholder}
      {groups.map((group, index) => (
        <ProtocolGroupRow
          key={group.key}
          group={group}
          pendingCount={pendingCountByProvider[group.providerCode] ?? 0}
          // the first provider opens by default so the page never lands on a
          // wall of collapsed rows
          expanded={isExpanded(group.key, index)}
          onToggle={() => toggle(group.key, index)}
          onManage={onManage}
        />
      ))}
    </YStack>
  );
}
