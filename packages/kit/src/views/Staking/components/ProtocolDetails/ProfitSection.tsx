import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { GridItem } from './GridItem';

type IProfitInfoProps = {
  apr?: string;
  earningsIn24h?: string;
  rewardTokens?: string;
  updateFrequency?: string;
  earnPoints?: boolean;
};

function ProfitInfo({
  apr,
  earningsIn24h,
  rewardTokens,
  updateFrequency,
  earnPoints,
}: IProfitInfoProps) {
  const intl = useIntl();

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_profit })}
      </SizableText>
      {earnPoints ? (
        <Alert
          title={intl.formatMessage({ id: ETranslations.earn_earn_points })}
          description={intl.formatMessage({
            id: ETranslations.earn_earn_points_desc,
          })}
        />
      ) : (
        <XStack flexWrap="wrap" m="$-5" p="$2">
          {apr && Number(apr) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_rewards_percentage,
              })}
            >
              <SizableText size="$bodyLgMedium" color="$textSuccess">
                {`${apr}% ${intl.formatMessage({
                  id: ETranslations.global_apr,
                })}`}
              </SizableText>
            </GridItem>
          ) : null}
          {earningsIn24h && Number(earningsIn24h) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_24h_earnings,
              })}
              tooltip={intl.formatMessage({
                id: ETranslations.earn_24h_earnings_tooltip,
              })}
            >
              <NumberSizeableText
                formatter="value"
                color="$textSuccess"
                size="$bodyLgMedium"
                formatterOptions={{ currency: symbol }}
              >
                {earningsIn24h}
              </NumberSizeableText>
            </GridItem>
          ) : null}
          {rewardTokens ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_reward_tokens,
              })}
            >
              {rewardTokens}
            </GridItem>
          ) : null}
          {updateFrequency ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_update_frequency,
              })}
            >
              {updateFrequency}
            </GridItem>
          ) : null}
        </XStack>
      )}
    </YStack>
  );
}

export const ProfitSection = ({
  details,
}: {
  details?: IStakeProtocolDetails;
}) => {
  const props = useMemo(() => {
    if (!details) {
      return null;
    }
    return {
      apr: Number(details.provider?.apr) > 0 ? details.provider.apr : undefined,
      earningsIn24h: details.earnings24h,
      rewardTokens: details.rewardToken,
      updateFrequency: details.updateFrequency,
    };
  }, [details]);
  if (!props) return null;
  return <ProfitInfo {...props} />;
};
