import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Stack, YStack } from '@onekeyhq/components';
import { ReferralBenefitsList } from '@onekeyhq/kit/src/views/ReferFriends/components/ReferralBenefitsList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

import { InviteCodeStepImage } from '../InviteCodeStepImage';

interface IReferAFriendHowToPhaseProps {
  actions?: ReactNode;
  postConfig: IInvitePostConfig;
}

export function ReferAFriendHowToPhase({
  actions,
  postConfig,
}: IReferAFriendHowToPhaseProps) {
  const intl = useIntl();

  const { inviterRebate, theirDiscount } = postConfig;

  return (
    <YStack gap="$5">
      <InviteCodeStepImage step={2} />

      <Stack maxWidth={480} mx="auto" gap="$10" px="$5">
        <ReferralBenefitsList
          title={intl.formatMessage({
            id: ETranslations.referral_intro_p2_title,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.referral_intro_p2_desc,
          })}
          benefits={[
            {
              icon: 'DollarOutline',
              text: intl.formatMessage(
                {
                  id: ETranslations.referral_intro_p2_desc_bullet1,
                },
                {
                  amount: `${inviterRebate?.amount ?? ''}${inviterRebate?.unit ?? ''}`,
                },
              ),
            },
            {
              icon: 'GiftOutline',
              text: intl.formatMessage(
                {
                  id: ETranslations.referral_intro_p2_desc_bullet2,
                },
                {
                  amount: `${theirDiscount?.amount ?? ''}${theirDiscount?.unit ?? ''}`,
                },
              ),
            },
          ]}
          bottomNote={intl.formatMessage({
            id: ETranslations.referral_intro_p2_note,
          })}
        />

        {actions}
      </Stack>
    </YStack>
  );
}
