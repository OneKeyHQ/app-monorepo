import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ReferralBenefitsList } from '@onekeyhq/kit/src/views/ReferFriends/components/ReferralBenefitsList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

interface IReferAFriendHowToPhaseProps {
  postConfig: IInvitePostConfig;
}

export function ReferAFriendHowToPhase({
  postConfig,
}: IReferAFriendHowToPhaseProps) {
  const intl = useIntl();

  const { inviterRebate, theirDiscount } = postConfig;

  return (
    <Stack maxWidth={480} w="100%" mx="auto">
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
    </Stack>
  );
}
