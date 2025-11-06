import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
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
    <YStack
      p="$5"
      gap="$5"
      animation="quick"
      enterStyle={{
        opacity: 0,
      }}
      exitStyle={{
        opacity: 0,
      }}
    >
      <InviteCodeStepImage step={2} />

      <ReferralBenefitsList
        title={intl.formatMessage({
          id: ETranslations.referral_intro_title_p2,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.referral_intro_desc_p2,
        })}
        benefits={[
          {
            icon: 'DollarOutline',
            text: intl.formatMessage({
              id: ETranslations.referral_intro_desc_bullet1_p2,
            }),
          },
          {
            icon: 'GiftOutline',
            text: intl.formatMessage({
              id: ETranslations.referral_intro_desc_bullet2_p2,
            }),
          },
        ]}
      />

      <JoinButton setPhaseState={setPhaseState} />
    </YStack>
  );
}
