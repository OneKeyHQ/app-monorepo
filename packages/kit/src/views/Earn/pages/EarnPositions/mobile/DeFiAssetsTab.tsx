import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PoolsPortfolioCards } from '../../../pools/components/PoolsPortfolioGroup';
import {
  UNISWAP_PROTOCOL,
  useUsdToFiat,
} from '../../../pools/usePoolsPortfolio';

import { EarnPositionProtocolList } from './EarnPositionProtocolList';
import { GroupRow, useGroupExpansion } from './GroupRow';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';
import type { IExtraProtocolRow } from './EarnPositionProtocolList';
import type { IPoolsPortfolioGroup } from '../../../pools/usePoolsPortfolio';

export function DeFiAssetsTab({
  protocols,
  isLoading,
  pendingCountByProvider,
  networkFilter,
  onManage,
  onRedeem,
  poolsGroups = [],
}: {
  protocols: IEarnProtocolView[];
  /** Pools demo: LP positions, one Uniswap row per network */
  poolsGroups?: IPoolsPortfolioGroup[];
  isLoading: boolean;
  pendingCountByProvider: Record<string, number>;
  /** the page's network chip; sits right under the tabs on this tab */
  networkFilter: React.ReactNode;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const expansion = useGroupExpansion();
  const currencyInfo = useCurrency();
  const toFiat = useUsdToFiat();
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const poolsRows: IExtraProtocolRow[] = poolsGroups.map((group) => {
    const value = Number(toFiat(group.valueUsd));
    return {
      key: group.key,
      value,
      node: (
        <GroupRow
          name={UNISWAP_PROTOCOL.name}
          logoURI={UNISWAP_PROTOCOL.logoURI}
          networkId={group.networkId}
          expanded={expansion.isExpanded(group.key)}
          onToggle={() => expansion.toggle(group.key)}
          testID={`earn-portfolio-item-uniswap-${group.networkId}`}
          total={
            <ProtocolValueCell
              value={value}
              currencySymbol={currencyInfo.symbol}
              priceUnavailableLabel={priceUnavailableLabel}
              size="$bodyLgMedium"
              textAlign="right"
              numberOfLines={1}
            />
          }
        >
          <PoolsPortfolioCards group={group} />
        </GroupRow>
      ),
    };
  });

  let placeholder: React.ReactNode = null;
  if (protocols.length === 0 && poolsRows.length === 0) {
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
      <EarnPositionProtocolList
        protocols={protocols}
        expansion={expansion}
        pendingCountByProvider={pendingCountByProvider}
        onManage={onManage}
        onRedeem={onRedeem}
        extraRows={poolsRows}
      />
      {/* scopes still landing behind the rows already shown */}
      {isLoading && protocols.length > 0 ? (
        <Stack ai="center" py="$4">
          <Spinner size="small" />
        </Stack>
      ) : null}
    </YStack>
  );
}
