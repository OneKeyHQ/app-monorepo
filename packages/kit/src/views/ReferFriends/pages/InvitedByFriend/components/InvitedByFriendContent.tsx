import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferralBenefitsList } from '../../../components';

function InvitedByFriendContent() {
  const intl = useIntl();

  const benefits = [
    {
      icon: 'GiftOutline' as const,
      text: intl.formatMessage({
        id: ETranslations.referral_modal_been_invited_point1,
      }),
    },
    {
      icon: 'DollarOutline' as const,
      text: intl.formatMessage({
        id: ETranslations.referral_modal_been_invited_point2,
      }),
    },
  ];

  return (
    <Stack mx="auto" gap="$10" px="$5" mt="$4">
      <ReferralBenefitsList
        title={intl.formatMessage({
          id: ETranslations.referral_modal_been_invited_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.referral_modal_been_invited_desc,
        })}
        benefits={benefits}
        bottomNote={intl.formatMessage({
          id: ETranslations.referral_intro_p1_note,
        })}
      />
    </Stack>
  );
}

export { InvitedByFriendContent };
