import { useIntl } from 'react-intl';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

import { InviteCodeStepImage } from '../InviteCodeStepImage';
import { ReferralBenefitsList } from '../ReferralBenefitsList';

import { NextButton } from './NextButton';

import type { EPhaseState } from '../../types';

interface IReferAFriendIntroPhaseProps {
  postConfig: IInvitePostConfig;
  setPhaseState: (state: EPhaseState | undefined) => void;
}

export function ReferAFriendIntroPhase({
  postConfig,
  setPhaseState,
}: IReferAFriendIntroPhaseProps) {
  const intl = useIntl();

  const benefits = [
    {
      icon: 'DollarOutline' as const,
      text: intl.formatMessage(
        {
          id: ETranslations.referral_intro_for_you_1,
        },
        {
          RebateRate: `${postConfig.commissionRate.amount}${postConfig.commissionRate.unit}`,
        },
      ),
    },
    {
      icon: 'GiftOutline' as const,
      text: intl.formatMessage(
        {
          id: ETranslations.referral_intro_for_your_friend_1,
        },
        {
          RebateAmount: `${postConfig.friendDiscount.unit}${postConfig.friendDiscount.amount}`,
        },
      ),
    },
  ];

  return (
    <YStack p="$5" gap="$5">
      {/* Preview image showing how to share invite code */}
      <YStack ai="center" mt="$2">
        <InviteCodeStepImage step={1} />
      </YStack>

      <Stack maxWidth={480} mx="auto" gap="$10">
        <ReferralBenefitsList
          title={intl.formatMessage(
            {
              id: ETranslations.referral_intro_title,
            },
            {
              RewardAmount: (
                <SizableText size="$heading2xl" color="$textSuccess">
                  {`${postConfig.referralReward.unit}${postConfig.referralReward.amount}`}
                </SizableText>
              ),
            },
          )}
          subtitle=""
          benefits={benefits}
        />

        <NextButton setPhaseState={setPhaseState} />
      </Stack>
    </YStack>
  );
}
