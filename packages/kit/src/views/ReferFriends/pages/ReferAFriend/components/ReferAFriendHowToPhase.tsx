import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { IntroStepLine } from './IntroStepLine';
import { InviteCodeStepImage } from './InviteCodeStepImage';

export function ReferAFriendHowToPhase() {
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
      <SizableText size="$heading2xl" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.referral_intro_title_2,
        })}
      </SizableText>
      <YStack gap="$5">
        {/* Step 1 with image */}
        <YStack gap="$3">
          <IntroStepLine
            no={1}
            description={intl.formatMessage({
              id: ETranslations.referral_how_1,
            })}
          />
          <InviteCodeStepImage step={1} />
        </YStack>

        {/* Step 2 with image */}
        <YStack gap="$3">
          <IntroStepLine
            no={2}
            description={intl.formatMessage({
              id: ETranslations.referral_how_2,
            })}
          />
          <InviteCodeStepImage step={2} />
        </YStack>

        {/* Step 3 without image */}
        <IntroStepLine
          no={3}
          description={intl.formatMessage({
            id: ETranslations.referral_how_3,
          })}
        />

        {/* Step 4 without image */}
        <IntroStepLine
          no={4}
          description={intl.formatMessage({
            id: ETranslations.referral_how_4,
          })}
        />
      </YStack>
      <YStack />
    </YStack>
  );
}
