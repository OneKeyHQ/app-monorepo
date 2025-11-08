import { useIntl } from 'react-intl';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToHardwareSalesReward } from '../../../HardwareSalesReward/hooks/useNavigateToHardwareSalesReward';
import { Card } from '../RewardCard';
import { FiatValue } from '../shared/FiatValue';
import { NoRewardYet } from '../shared/NoRewardYet';

import type { IHardwareSalesRewardProps } from './types';

export function HardwareSalesReward({
  hardwareSales,
  levelPercent: _levelPercent,
  rebateLevels: _rebateLevels,
  rebateConfig: _rebateConfig,
}: IHardwareSalesRewardProps) {
  const toHardwareSalesRewardPage = useNavigateToHardwareSalesReward();
  const intl = useIntl();

  console.log('hardwareSales', hardwareSales);

  const showHardwareSalesAvailableFiat =
    (hardwareSales.available?.length || 0) > 0;
  const showHardwarePendingFiat = (hardwareSales.pending?.length || 0) > 0;

  return (
    <Card.Container>
      <Card.Title
        icon="OnekeyLiteOutline"
        title={hardwareSales.title}
        description={hardwareSales.description}
        onPress={toHardwareSalesRewardPage}
      />

      {(() => {
        if (!showHardwareSalesAvailableFiat && !showHardwarePendingFiat) {
          return <NoRewardYet />;
        }

        const available = hardwareSales.available?.[0];
        const pending = hardwareSales.pending?.[0];
        const availableToken = available?.token;
        const pendingToken = pending?.token;

        const hasTokenNetworkId =
          availableToken?.networkId || pendingToken?.networkId;

        return (
          <XStack gap="$2" pt="$4">
            {hasTokenNetworkId ? (
              <Token
                size="xs"
                tokenImageUri={availableToken?.logoURI || pendingToken?.logoURI}
              />
            ) : null}

            <SizableText size="$bodyMd">
              <NumberSizeableText
                formatter="value"
                size="$bodyMd"
                formatterOptions={{
                  tokenSymbol: availableToken?.symbol,
                }}
              >
                {available?.amount || 0}
              </NumberSizeableText>
              {available?.amount ? (
                <FiatValue fiatValue={available?.fiatValue} />
              ) : null}
              {showHardwarePendingFiat ? (
                <>
                  <SizableText size="$bodyMd">{` + `}</SizableText>
                  <NumberSizeableText
                    formatter="value"
                    size="$bodyMd"
                    formatterOptions={{
                      tokenSymbol: pendingToken?.symbol,
                    }}
                  >
                    {pending?.amount || 0}
                  </NumberSizeableText>
                  {pending?.amount ? (
                    <FiatValue fiatValue={pending?.fiatValue} />
                  ) : null}
                </>
              ) : null}
            </SizableText>
            {showHardwarePendingFiat ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.referral_sales_reward_pending,
                })}
              </SizableText>
            ) : null}
          </XStack>
        );
      })()}
    </Card.Container>
  );
}
