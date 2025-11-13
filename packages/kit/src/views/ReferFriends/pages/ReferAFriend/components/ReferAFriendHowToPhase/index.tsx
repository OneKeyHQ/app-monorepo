import { useIntl } from 'react-intl';

import { Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InviteCodeStepImage } from '../InviteCodeStepImage';
import { ReferralBenefitsList } from '../ReferralBenefitsList';

import { JoinButton } from './JoinButton';

import type { EPhaseState } from '../../types';

interface IReferAFriendHowToPhaseProps {
  setPhaseState: (state: EPhaseState | undefined) => void;
}

export function ReferAFriendHowToPhase({
  setPhaseState,
}: IReferAFriendHowToPhaseProps) {
  const intl = useIntl();

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
              text: intl.formatMessage({
                id: ETranslations.referral_intro_p2_desc_bullet1,
              }),
            },
            {
              icon: 'GiftOutline',
              text: intl.formatMessage({
                id: ETranslations.referral_intro_p2_desc_bullet2,
              }),
            },
          ]}
          bottomNote={intl.formatMessage({
            id: ETranslations.referral_intro_p2_note,
          })}
        />

        <JoinButton setPhaseState={setPhaseState} />
      </Stack>
    </YStack>
  );
}
