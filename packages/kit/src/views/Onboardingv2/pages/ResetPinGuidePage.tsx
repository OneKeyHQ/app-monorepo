import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

function ResetPinGuidePage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const handleDone = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const STEPS = [
    {
      title: intl.formatMessage({
        id: ETranslations.reset_pin_open_other_device,
      }),
      description: intl.formatMessage({
        id: ETranslations.reset_pin_open_other_device_desc,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.reset_pin_go_to_settings,
      }),
      description: intl.formatMessage({
        id: ETranslations.reset_pin_go_to_settings_desc,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.reset_pin_set_your_new_pin,
      }),
      description: intl.formatMessage({
        id: ETranslations.reset_pin_set_your_new_pin_desc,
      }),
    },
  ];

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <YStack gap="$2">
              <SizableText size="$heading2xl">
                {intl.formatMessage({
                  id: ETranslations.reset_pin_using_another_device,
                })}
              </SizableText>
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.reset_pin_using_another_device_desc,
                })}
              </SizableText>
            </YStack>
            <YStack gap="$6">
              {STEPS.map((step, index) => (
                <XStack gap="$3" key={step.title}>
                  <YStack
                    bg="$bgInfo"
                    w="$6"
                    h="$6"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="$full"
                  >
                    <SizableText size="$bodyMd" color="$textInfo">
                      {index + 1}
                    </SizableText>
                  </YStack>
                  <YStack gap="$1" flex={1}>
                    <SizableText size="$bodyLgMedium">{step.title}</SizableText>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {step.description}
                    </SizableText>
                  </YStack>
                </XStack>
              ))}

              {gtMd ? (
                <Button size="large" variant="primary" onPress={handleDone}>
                  {intl.formatMessage({
                    id: ETranslations.i_have_done_these_steps,
                  })}
                </Button>
              ) : null}
            </YStack>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {!gtMd ? (
          <OnboardingLayout.Footer>
            <Button
              size="large"
              w="100%"
              variant="primary"
              onPress={handleDone}
            >
              {intl.formatMessage({
                id: ETranslations.i_have_done_these_steps,
              })}
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}

export { ResetPinGuidePage as default };
