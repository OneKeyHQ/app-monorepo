import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { ReferralBenefitsList } from '@onekeyhq/kit/src/views/ReferFriends/components/ReferralBenefitsList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

import { InviteCodeStepImage } from '../InviteCodeStepImage';

interface IReferAFriendIntroPhaseProps {
  postConfig: IInvitePostConfig;
  actions?: ReactNode;
}

export function ReferAFriendIntroPhase({
  postConfig,
  actions,
}: IReferAFriendIntroPhaseProps) {
  const intl = useIntl();

  const benefits = [
    {
      icon: 'DollarOutline' as const,
      text: intl.formatMessage(
        {
          id: ETranslations.referral_intro_p1_desc_bullet1,
        },
        {
          amount: `${postConfig.commissionRate.amount}${postConfig.commissionRate.unit}`,
        },
      ),
    },
    {
      icon: 'GiftOutline' as const,
      text: intl.formatMessage(
        {
          id: ETranslations.referral_intro_p1_desc_bullet2,
        },
        {
          amount: `${postConfig.friendDiscount.unit}${postConfig.friendDiscount.amount}`,
        },
      ),
    },
  ];

  return (
    <YStack gap="$5">
      <InviteCodeStepImage step={1} />

      <Stack maxWidth={480} mx="auto" gap="$10" px="$5">
        <ReferralBenefitsList
          title={intl.formatMessage(
            {
              id: ETranslations.referral_intro_p1_title,
            },
            {
              amount: (
                <SizableText
                  key="reward-amount"
                  size="$heading2xl"
                  color="$textSuccess"
                >
                  {`${postConfig.referralReward.unit}${postConfig.referralReward.amount}`}
                </SizableText>
              ),
            },
          )}
          subtitle=""
          benefits={benefits}
          bottomNote={intl.formatMessage({
            id: ETranslations.referral_intro_p1_note,
          })}
        />

        {actions}
      </Stack>
    </YStack>
  );
}
