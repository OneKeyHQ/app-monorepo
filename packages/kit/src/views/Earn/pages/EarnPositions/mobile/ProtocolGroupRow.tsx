import { NumberSizeableText } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';

import { EarnTestIDs } from '../../../testIDs';

import { GroupRow } from './GroupRow';
import { PositionCard } from './PositionCard';

import type {
  IPositionManageHandler,
  IProtocolGroup,
} from './myPortfolio.utils';

/**
 * One provider's positions: the collapsible row carries the provider and its
 * fiat total, and opens into one PositionCard per vault. `rewardsOnly` is the
 * Claimable-tab variant, where the cards show only their reward rows.
 */
export function ProtocolGroupRow({
  group,
  pendingCount = 0,
  expanded,
  onToggle,
  rewardsOnly = false,
  onManage,
}: {
  group: IProtocolGroup;
  pendingCount?: number;
  expanded: boolean;
  onToggle: () => void;
  rewardsOnly?: boolean;
  onManage?: IPositionManageHandler;
}) {
  const currencyInfo = useCurrency();

  return (
    <GroupRow
      name={group.providerName}
      logoURI={group.providerLogoURI}
      pendingCount={pendingCount}
      expanded={expanded}
      onToggle={onToggle}
      testID={EarnTestIDs.portfolioItem(group.providerName)}
      total={
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: currencyInfo.symbol }}
          numberOfLines={1}
        >
          {group.totalFiatValue}
        </NumberSizeableText>
      }
    >
      {group.investments.map((investment) => (
        <PositionCard
          key={`${investment.protocol.providerDetail.code}-${investment.protocol.symbol ?? ''}-${investment.protocol.vault ?? ''}-${investment.network.networkId}`}
          investment={investment}
          rewardsOnly={rewardsOnly}
          onManage={onManage}
        />
      ))}
    </GroupRow>
  );
}
