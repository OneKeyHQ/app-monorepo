import { FormattedMessage, useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferralBenefitsList } from '../../../components';
import { useInvitePostConfig } from '../../../hooks/useInvitePostConfig';
import { formatInviteeDiscountFromConfig } from '../../../utils';

function InvitedByFriendContent({ referralCode }: { referralCode?: string }) {
  const intl = useIntl();
  const { postConfig, isSettled } = useInvitePostConfig();
  const inviteeDiscountAmount = formatInviteeDiscountFromConfig(
    postConfig?.inviteeDiscount,
  );

  // Held back until the config has answered, so a first open never shows the
  // default rate and then swaps it for the server's.
  const benefits = !isSettled
    ? []
    : [
        {
          icon: 'GiftOutline' as const,
          text: intl.formatMessage(
            {
              id: ETranslations.referral_modal_been_invited_point1,
            },
            {
              amount: inviteeDiscountAmount,
            },
          ),
        },
      ];

  return (
    <Stack mx="auto" gap="$10" px="$5" mt="$4">
      <ReferralBenefitsList
        title={
          <FormattedMessage
            id={ETranslations.referral_modal_been_invited_title_code}
            values={{
              ABCDEF: (
                <SizableText size="$heading2xl" color="$textInfo">
                  {referralCode}
                </SizableText>
              ),
            }}
          />
        }
        subtitle={intl.formatMessage({
          id: ETranslations.referral_modal_been_invited_desc,
        })}
        benefits={benefits}
        bottomNote={intl.formatMessage({
          id: ETranslations.referral_intro_p2_note,
        })}
      />
    </Stack>
  );
}

export { InvitedByFriendContent };
