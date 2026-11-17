import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ReferralBenefitsList } from '@onekeyhq/kit/src/views/ReferFriends/components/ReferralBenefitsList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

interface IReferAFriendIntroPhaseProps {
  postConfig: IInvitePostConfig;
}

export function ReferAFriendIntroPhase({
  postConfig,
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
          amount: `${postConfig.commissionRate?.amount ?? ''}${postConfig.commissionRate?.unit ?? ''}`,
        },
      ),
    },
  ];

  return (
    <Stack maxWidth={480} w="100%" mx="auto">
      <ReferralBenefitsList
        title={intl.formatMessage(
          {
            id: ETranslations.referral_intro_p1_title,
          },
          {
            amount: (
              <SizableText
                // `react-intl` may return an array of nodes; ensure the element has a stable key.
                key="referral_reward_amount"
                size="$heading2xl"
                color="$textSuccess"
              >
                {`${postConfig.referralReward?.unit ?? ''}${postConfig.referralReward?.amount ?? ''}`}
              </SizableText>
            ),
          },
        )}
        subtitle={intl.formatMessage({
          id: ETranslations.referral_intro_hardware__desc,
        })}
        benefits={benefits}
        bottomNote={intl.formatMessage({
          id: ETranslations.referral_intro_p1_note,
        })}
      />
    </Stack>
  );
}
