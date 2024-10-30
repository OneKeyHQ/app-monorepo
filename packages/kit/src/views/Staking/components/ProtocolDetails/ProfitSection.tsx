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
  rewardToken?: string;
  rewardTokens?: string;
  updateFrequency?: string;
  unstakingPeriod?: number;
  earnPoints?: boolean;
};

function ProfitInfo({
  apr,
  earningsIn24h,
  rewardToken,
  rewardTokens,
  updateFrequency,
  unstakingPeriod,
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
          {unstakingPeriod ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_unstaking_period,
              })}
              tooltip={
                rewardToken === 'APT'
                  ? intl.formatMessage({
                      id: ETranslations.earn_earn_during_unstaking_tooltip,
                    })
                  : undefined
              }
            >
              {intl.formatMessage(
                { id: ETranslations.earn_up_to_number_days },
                { number: unstakingPeriod },
              )}
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
  if (!details) {
    return null;
  }
  const props: IProfitInfoProps = {
    apr: Number(details.provider?.apr) > 0 ? details.provider.apr : undefined,
    earningsIn24h: details.earnings24h,
    rewardToken: details.rewardToken,
    rewardTokens: details.rewardToken,
    // updateFrequency: details.updateFrequency,
    earnPoints: details.provider.earnPoints,
    unstakingPeriod: details.unstakingPeriod,
  };
  return <ProfitInfo {...props} />;
};
