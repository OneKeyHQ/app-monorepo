import { useEffect, useState } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

import { ReferralBenefitsList } from '../../../components';

function InvitedByFriendContent({ referralCode }: { referralCode?: string }) {
  const intl = useIntl();
  const [postConfig, setPostConfig] = useState<IInvitePostConfig | undefined>(
    undefined,
  );

  useEffect(() => {
    async function loadPostConfig() {
      const cachedConfig =
        await backgroundApiProxy.serviceReferralCode.getPostConfig();
      if (cachedConfig) {
        setPostConfig(cachedConfig);
      }
      const freshConfig =
        await backgroundApiProxy.serviceReferralCode.fetchPostConfig();
      if (freshConfig) {
        setPostConfig(freshConfig);
      }
    }
    void loadPostConfig();
  }, []);

  const inviteeDiscount = postConfig?.inviteeDiscount as
    | { amount: number; unit: string }
    | undefined;
  const inviteeDiscountAmount = inviteeDiscount
    ? `${inviteeDiscount.amount}${inviteeDiscount.unit}`
    : '';

  const benefits = [
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
