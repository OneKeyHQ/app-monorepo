import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, Page, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

function NewPinCreatedPage() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const handleClose = useCallback(() => {
    // Exit the entire onboarding flow
    navigation.popStack();
  }, [navigation]);

  // Close this page 5s later automatically
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [handleClose]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header showBackButton={false} />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <YStack gap="$2">
              <YStack
                p="$5"
                bg="$bgSuccessStrong"
                borderRadius="$full"
                alignSelf="flex-start"
                mb="$5"
              >
                <Icon name="CheckmarkSolid" color="$iconOnColor" />
              </YStack>
              <SizableText size="$heading2xl">
                {intl.formatMessage({ id: ETranslations.new_pin_created })}
              </SizableText>
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.new_pin_created_desc,
                })}
              </SizableText>
            </YStack>
            <Button size="large" onPress={handleClose}>
              {intl.formatMessage({ id: ETranslations.global_close })}
            </Button>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export { NewPinCreatedPage as default };
