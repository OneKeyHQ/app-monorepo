import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ClaimableRewardRow } from '../../pages/EarnPositions/mobile/ClaimableRewardRow';
import { GroupRow } from '../../pages/EarnPositions/mobile/GroupRow';
import { getPoolPair, getPoolPairTitle } from '../poolsFormat';
import { canCollectPoolFees, usePoolCollect } from '../usePoolCollect';
import { UNISWAP_PROTOCOL, useUsdToFiat } from '../usePoolsPortfolio';

import type { IGroupExpansion } from '../../pages/EarnPositions/mobile/GroupRow';
import type { IPoolsPortfolioGroup } from '../usePoolsPortfolio';

/** Unclaimed fees the user claims by hand, in USD */
export function getPoolsClaimableUsd(groups: IPoolsPortfolioGroup[]) {
  return groups
    .flatMap((group) => group.positions)
    .filter(canCollectPoolFees)
    .reduce((sum, view) => sum.plus(view.uncollectedFeesUsd), new BigNumber(0));
}

/**
 * Rewards › Claimable for one network's LP positions: the protocol group the
 * other protocols use, a row per fee token. One claim takes both tokens of a
 * position, so it sits on the position's first row.
 */
export function PoolsRewardsGroup({
  group,
  expansion,
}: {
  group: IPoolsPortfolioGroup;
  expansion: IGroupExpansion;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const toFiat = useUsdToFiat();
  const { collect, collectingId } = usePoolCollect();
  const views = group.positions.filter(canCollectPoolFees);
  if (!views.length) {
    return null;
  }
  const key = `${group.key}-rewards`;
  return (
    <GroupRow
      name={UNISWAP_PROTOCOL.name}
      logoURI={UNISWAP_PROTOCOL.logoURI}
      networkId={group.networkId}
      expanded={expansion.isExpanded(key)}
      onToggle={() => expansion.toggle(key)}
      testID={`earn-pools-rewards-group-${group.networkId}`}
      total={
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: currencyInfo.symbol }}
          textAlign="right"
          numberOfLines={1}
        >
          {toFiat(getPoolsClaimableUsd([group]))}
        </NumberSizeableTextWrapper>
      }
    >
      <YStack
        px="$3"
        py="$1"
        borderRadius="$3"
        borderWidth="$px"
        borderColor="$borderSubdued"
        bg="$bg"
      >
        {views.flatMap((view) => {
          const { pool, position } = view;
          const { inverted } = getPoolPair(pool);
          const fees = [
            { token: pool.token0, amount: position.uncollectedFees0 },
            { token: pool.token1, amount: position.uncollectedFees1 },
          ];
          const rows = (inverted ? fees.toReversed() : fees).filter((row) =>
            new BigNumber(row.amount).gt(0),
          );
          return rows.map((row, index) => (
            <ClaimableRewardRow
              key={`${position.id}-${row.token.id}`}
              networkId={pool.networkId}
              logoURI={row.token.logoURI}
              title={
                <NumberSizeableTextWrapper
                  hideValue
                  size="$bodyMdMedium"
                  formatter="balance"
                  formatterOptions={{ tokenSymbol: row.token.symbol }}
                  numberOfLines={1}
                >
                  {row.amount}
                </NumberSizeableTextWrapper>
              }
              subtitle={getPoolPairTitle(pool)}
              fiatValue={toFiat(
                new BigNumber(row.amount).times(row.token.priceUsd),
              )}
              action={
                index === 0 ? (
                  <Button
                    size="small"
                    variant="secondary"
                    loading={collectingId === position.id}
                    onPress={() => void collect(view)}
                    testID={`earn-pools-rewards-claim-${position.id}`}
                  >
                    {intl.formatMessage({ id: ETranslations.earn_claim })}
                  </Button>
                ) : null
              }
            />
          ));
        })}
      </YStack>
    </GroupRow>
  );
}
