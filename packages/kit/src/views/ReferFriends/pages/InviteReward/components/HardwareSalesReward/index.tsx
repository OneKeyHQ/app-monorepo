import { useIntl } from 'react-intl';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToHardwareSalesReward } from '../../../HardwareSalesReward/hooks/useNavigateToHardwareSalesReward';
import { Card } from '../RewardCard';
import { NoRewardYet } from '../shared/NoRewardYet';

import type { IHardwareSalesRewardProps } from './types';

export function HardwareSalesReward({
  hardwareSales,
  nextDistribution,
}: IHardwareSalesRewardProps) {
  const toHardwareSalesRewardPage = useNavigateToHardwareSalesReward();
  const intl = useIntl();

  const showHardwareSalesAvailableFiat =
    (hardwareSales.available?.length || 0) > 0;
  const showHardwarePendingFiat = (hardwareSales.pending?.length || 0) > 0;

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="OnekeyLiteOutline"
        title={hardwareSales.title}
        description={intl.formatMessage({
          id: ETranslations.referral_hw_sales_desc,
        })}
        onPress={toHardwareSalesRewardPage}
      />

      {/* Monthly sales */}
      {hardwareSales.monthlySalesFiatValue ? (
        <>
          <Card.Item
            label={intl.formatMessage({
              id: ETranslations.referral_hw_sales_title,
            })}
            value={
              <Currency formatter="value" size="$bodyMdMedium">
                {hardwareSales.monthlySalesFiatValue}
              </Currency>
            }
          />
          <Card.Divider />
        </>
      ) : null}

      {!showHardwareSalesAvailableFiat && !showHardwarePendingFiat ? (
        <NoRewardYet />
      ) : (
        <>
          {showHardwareSalesAvailableFiat ? (
            <Card.Item
              label={intl.formatMessage({
                id: ETranslations.referral_undistributed,
              })}
              infoTooltip={{
                title: intl.formatMessage({
                  id: ETranslations.referral_hw_undistributed_pop_title,
                }),
                content: intl.formatMessage(
                  { id: ETranslations.referral_hw_undistributed_pop },
                  { date: nextDistribution },
                ),
              }}
              value={
                <Card.TokenValue
                  tokenImageUri={hardwareSales.available?.[0]?.token?.logoURI}
                  amount={hardwareSales.available?.[0]?.amount || 0}
                  symbol={hardwareSales.available?.[0]?.token?.symbol}
                />
              }
            />
          ) : null}

          {showHardwarePendingFiat ? (
            <Card.Item
              label={intl.formatMessage({
                id: ETranslations.referral_sales_reward_pending,
              })}
              infoTooltip={{
                title: intl.formatMessage({
                  id: ETranslations.referral_hw_pending_pop_title,
                }),
                content: intl.formatMessage({
                  id: ETranslations.referral_hw_pending_pop,
                }),
              }}
              value={
                <Card.TokenValue
                  tokenImageUri={hardwareSales.pending?.[0]?.token?.logoURI}
                  amount={hardwareSales.pending?.[0]?.amount || 0}
                  symbol={hardwareSales.pending?.[0]?.token?.symbol}
                />
              }
            />
          ) : null}
        </>
      )}
    </Card.Container>
  );
}
