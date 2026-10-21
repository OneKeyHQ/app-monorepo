import { XStack, YStack } from '@onekeyhq/components';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../ProtocolDetails/EarnActionIcon';
import { EarnText } from '../ProtocolDetails/EarnText';
import { EarnTooltip } from '../ProtocolDetails/EarnTooltip';

import type { FontSizeTokens } from 'tamagui';

type IConfirmationReward = NonNullable<
  IStakeTransactionConfirmation['rewards']
>[number];

type IConfirmationApyDetail = NonNullable<
  IStakeTransactionConfirmation['apyDetail']
>;

function ConfirmationRewardRow({
  reward,
  mt,
}: {
  reward: IConfirmationReward;
  mt?: '$1.5';
}) {
  const hasTooltip = reward.tooltip?.type === 'text';
  let descriptionTextSize = (
    hasTooltip ? '$bodyMd' : '$bodyLgMedium'
  ) as FontSizeTokens;
  if (reward.description.size) {
    descriptionTextSize = reward.description.size;
  }
  return (
    <XStack gap="$1" ai="flex-start" mt={mt} flexWrap="wrap">
      <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
        <EarnText
          text={reward.title}
          color={reward.title.color}
          size={reward.title.size}
        />
        <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
          <EarnText
            text={reward.description}
            size={descriptionTextSize}
            color={reward.description.color ?? '$textSubdued'}
            flexShrink={1}
          />
          {hasTooltip ? (
            <EarnTooltip title={reward.title.text} tooltip={reward.tooltip} />
          ) : null}
        </XStack>
      </XStack>
    </XStack>
  );
}

// A form opened with a protocol switcher (the trending entry) keeps only the
// highlighted reward rows
function getInfoRewards(
  transactionConfirmation?: IStakeTransactionConfirmation,
) {
  return (
    transactionConfirmation?.rewards?.filter(
      (reward) => !!reward.title.color,
    ) ?? []
  );
}

export function hasStakingRewardsSummary({
  transactionConfirmation,
  infoOnly,
}: {
  transactionConfirmation?: IStakeTransactionConfirmation;
  infoOnly?: boolean;
}) {
  if (infoOnly) {
    return getInfoRewards(transactionConfirmation).length > 0;
  }
  return Boolean(
    transactionConfirmation?.title ||
    transactionConfirmation?.tooltip ||
    transactionConfirmation?.rewards?.length,
  );
}

/**
 * The rewards part of a deposit form's summary card, as the server words it
 * for the amount: "Est. annual rewards" and a row per reward token. Shared by
 * the deposit form and the Earn Router's swap-then-deposit form
 */
export function StakingRewardsSummary({
  transactionConfirmation,
  infoOnly,
}: {
  transactionConfirmation?: IStakeTransactionConfirmation;
  infoOnly?: boolean;
}) {
  if (infoOnly) {
    const infoRewards = getInfoRewards(transactionConfirmation);
    if (!infoRewards.length) {
      return null;
    }
    return (
      <YStack gap="$2">
        {infoRewards.map((reward) => (
          <ConfirmationRewardRow
            key={reward.title.text}
            reward={reward}
            mt="$1.5"
          />
        ))}
      </YStack>
    );
  }
  return (
    <YStack gap="$1.5">
      <XStack ai="center" gap="$1">
        <EarnText
          text={transactionConfirmation?.title}
          color="$textSubdued"
          size="$bodyMd"
          boldTextProps={{
            size: '$bodyMdMedium',
          }}
        />
        {transactionConfirmation?.tooltip ? (
          <EarnTooltip
            title={transactionConfirmation?.title?.text}
            tooltip={transactionConfirmation?.tooltip}
          />
        ) : null}
      </XStack>
      {transactionConfirmation?.rewards?.map((reward) => (
        <ConfirmationRewardRow key={reward.title.text} reward={reward} />
      ))}
    </YStack>
  );
}

// The rate atop the summary card where the form shows it (a modal)
export function StakingApyHeader({
  apyDetail,
}: {
  apyDetail: IConfirmationApyDetail;
}) {
  return (
    <XStack gap="$1" ai="center" mb="$3.5">
      <EarnText
        text={apyDetail.description}
        size="$headingLg"
        color="$textSuccess"
      />
      <EarnActionIcon
        title={apyDetail.title.text}
        actionIcon={apyDetail.button}
      />
    </XStack>
  );
}
