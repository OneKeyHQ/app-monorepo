import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
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
          RebateRate: (
            <SizableText color="$textSuccess">
              {`${postConfig.commissionRate.amount}${postConfig.commissionRate.unit}`}
            </SizableText>
          ),
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
          RebateAmount: (
            <SizableText color="$textInfo">
              {`${postConfig.friendDiscount.unit}${postConfig.friendDiscount.amount}`}
            </SizableText>
          ),
        },
      ),
    },
  ];

  return (
    <YStack
      p="$5"
      gap="$5"
      animation="quick"
      enterStyle={{
        opacity: 1,
      }}
      exitStyle={{
        opacity: 0,
      }}
    >
      {/* Preview image showing how to share invite code */}
      <YStack ai="center" mt="$2">
        <InviteCodeStepImage step={1} />
      </YStack>

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

      <YStack px="$5" pb="$5">
        <NextButton setPhaseState={setPhaseState} />
      </YStack>
    </YStack>
  );
}
