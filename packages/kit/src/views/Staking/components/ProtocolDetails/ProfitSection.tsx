import { useIntl } from 'react-intl';

import {
  Alert,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { formatApy } from '@onekeyhq/kit/src/views/Staking/components/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type {
  IEarnRewardUnit,
  IEarnTokenItem,
  IRewardApys,
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';

import { formatStakingDistanceToNowStrict } from '../utils';

import { GridItem } from './GridItem';
import { MorphoApy } from './MorphoApy';

type IProfitInfoProps = {
  apr?: string;
  apys?: IRewardApys;
  rewardUnit: IEarnRewardUnit;
  rewardAssets?: Record<string, IEarnTokenItem>;
  earningsIn24h?: string;
  rewardToken?: string;
  rewardTokens?: string;
  receiptToken?: string;
  updateFrequency?: string;
  unstakingPeriod?: number;
  earnPoints?: boolean;
  stakingTime?: number;
  nextLaunchLeft?: string;
  providerName?: string;
  poolFee?: string;
};

function ProfitInfo({
  apr,
  apys,
  rewardAssets,
  earningsIn24h,
  rewardToken,
  rewardTokens,
  receiptToken,
  updateFrequency,
  unstakingPeriod,
  stakingTime,
  earnPoints,
  rewardUnit,
  providerName,
  poolFee,
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
          {!apys && apr && Number(apr) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_rewards_percentage,
              })}
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyLgMedium" color="$textSuccess">
                  {`${formatApy(apr)}% ${rewardUnit}`}
                </SizableText>
              </XStack>
            </GridItem>
          ) : null}
          {apys?.dailyNetApy && Number(apys.dailyNetApy) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_rewards_percentage,
              })}
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyLgMedium" color="$textSuccess">
                  {`${formatApy(apys?.dailyNetApy)}% ${rewardUnit}`}
                </SizableText>
                {apys ? (
                  <Popover
                    floatingPanelProps={{
                      w: 320,
                    }}
                    title={intl.formatMessage({
                      id: ETranslations.earn_rewards,
                    })}
                    renderTrigger={
                      <IconButton
                        icon="CoinsAddOutline"
                        size="small"
                        variant="tertiary"
                      />
                    }
                    renderContent={
                      <MorphoApy
                        apys={apys}
                        rewardAssets={rewardAssets}
                        poolFee={
                          earnUtils.isMorphoProvider({
                            providerName: providerName || '',
                          })
                            ? poolFee
                            : undefined
                        }
                      />
                    }
                    placement="top"
                  />
                ) : null}
              </XStack>
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
          {receiptToken || rewardTokens ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_reward_tokens,
              })}
            >
              {receiptToken || rewardTokens}
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
          {stakingTime ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_earnings_start,
              })}
            >
              {intl.formatMessage(
                { id: ETranslations.earn_in_number },
                {
                  number: formatStakingDistanceToNowStrict(stakingTime),
                },
              )}
            </GridItem>
          ) : null}
          {unstakingPeriod ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_unstaking_period,
              })}
              tooltip={intl.formatMessage({
                id:
                  rewardToken === 'APT'
                    ? ETranslations.earn_earn_during_unstaking_tooltip
                    : ETranslations.earn_unstaking_period_tooltip,
              })}
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
    apr:
      Number(details.provider?.aprWithoutFee) > 0
        ? details.provider.aprWithoutFee
        : undefined,
    apys: details.provider.apys,
    rewardAssets: details.rewardAssets,
    earningsIn24h: details.earnings24h,
    rewardToken: details.rewardToken,
    rewardTokens: details.rewardToken,
    receiptToken: details.provider.receiptToken,
    // updateFrequency: details.updateFrequency,
    earnPoints: details.provider.earnPoints,
    unstakingPeriod: details.unstakingPeriod,
    stakingTime: details.provider.stakingTime,
    nextLaunchLeft: details.provider.nextLaunchLeft,
    rewardUnit: details.provider.rewardUnit,
    providerName: details.provider.name,
    poolFee: details.provider.poolFee,
  };
  return <ProfitInfo {...props} />;
};
