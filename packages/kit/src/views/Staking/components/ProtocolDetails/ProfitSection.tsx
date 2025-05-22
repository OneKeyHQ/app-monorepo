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
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';

import { useEarnEventActive } from '../../hooks/useEarnEventActive';
import { formatStakingDistanceToNowStrict } from '../utils';

import { GridItem } from './GridItem';
import { ProtocolApyRewards } from './ProtocolApyRewards';

type IProfitInfoProps = {
  details: IStakeProtocolDetails;
  apr?: string;
  rewardUnit: IEarnRewardUnit;
  totalRewardAmount?: string;
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
  token: IStakeProtocolDetails['token'];
  joinRequirement?: string;
};

function ProfitInfo({
  details,
  apr,
  earningsIn24h,
  rewardToken,
  rewardTokens,
  receiptToken,
  updateFrequency,
  unstakingPeriod,
  stakingTime,
  totalRewardAmount,
  earnPoints,
  rewardUnit,
  providerName,
  joinRequirement,
  token,
}: IProfitInfoProps) {
  const intl = useIntl();

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  const apys = details.provider.apys;
  const aprWithoutFee = details.provider.aprWithoutFee;
  const isFalconProvider = earnUtils.isFalconProvider({
    providerName: providerName || '',
  });
  const { isEventActive } = useEarnEventActive(details.provider.eventEndTime);

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
          {(apys?.dailyNetApy && Number(apys.dailyNetApy) > 0) ||
          (apys?.weeklyNetApy && Number(apys.weeklyNetApy) > 0) ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_rewards_percentage,
              })}
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyLgMedium" color="$textSuccess">
                  {`${formatApy(
                    isFalconProvider ? aprWithoutFee : apys?.dailyNetApy,
                  )}% ${rewardUnit}`}
                </SizableText>
                {/* {apys ? (
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
                    renderContent={<ProtocolApyRewards details={details} />}
                    placement="top"
                  />
                ) : null} */}
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
                formatterOptions={{
                  currency: symbol,
                  showPlusMinusSigns: Number(earningsIn24h) >= 0.01,
                }}
              >
                {earningsIn24h}
              </NumberSizeableText>
            </GridItem>
          ) : null}
          {totalRewardAmount && Number(totalRewardAmount) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_referral_total_earned,
              })}
            >
              <NumberSizeableText
                formatter="balance"
                color="$textSuccess"
                size="$bodyLgMedium"
                formatterOptions={{
                  tokenSymbol: token.info.symbol,
                  showPlusMinusSigns: Number(totalRewardAmount) > 0,
                }}
              >
                {totalRewardAmount}
              </NumberSizeableText>
            </GridItem>
          ) : null}
          {receiptToken || rewardTokens ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_reward_tokens,
              })}
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyLgMedium">
                  {receiptToken || rewardTokens}
                </SizableText>
                {isFalconProvider && isEventActive ? (
                  <Popover
                    placement="top"
                    title={intl.formatMessage({
                      id: ETranslations.earn_reward_tokens,
                    })}
                    renderTrigger={
                      <IconButton
                        iconColor="$iconSubdued"
                        size="small"
                        icon="InfoCircleOutline"
                        variant="tertiary"
                      />
                    }
                    renderContent={
                      <XStack p="$5">
                        <SizableText>
                          {intl.formatMessage({
                            id: ETranslations.earn_fixed_yield_info,
                          })}
                        </SizableText>
                      </XStack>
                    }
                  />
                ) : null}
              </XStack>
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
          {stakingTime &&
          !earnUtils.isEverstakeProvider({
            providerName: providerName || '',
          }) ? (
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
          {joinRequirement && Number(joinRequirement) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_join_requirement,
              })}
            >
              <NumberSizeableText
                formatter="balance"
                color="$text"
                size="$bodyLgMedium"
                formatterOptions={{
                  tokenSymbol: rewardToken,
                }}
              >
                {joinRequirement}
              </NumberSizeableText>
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
    details,
    apr:
      Number(details.provider?.aprWithoutFee) > 0
        ? details.provider.aprWithoutFee
        : undefined,
    earningsIn24h: details.earnings24h,
    totalRewardAmount: details.totalRewardAmount,
    rewardToken: details.rewardToken,
    rewardTokens: details.rewardToken,
    receiptToken: details.provider.receiptToken,
    earnPoints: details.provider.earnPoints,
    unstakingPeriod: details.unstakingPeriod,
    stakingTime: details.provider.stakingTime,
    nextLaunchLeft: details.provider.nextLaunchLeft,
    rewardUnit: details.provider.rewardUnit,
    providerName: details.provider.name,
    token: details.token,
    joinRequirement: details.provider.joinRequirement,
  };
  return <ProfitInfo {...props} />;
};
