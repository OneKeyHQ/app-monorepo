import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingIconBadge, OnboardingPage } from '../components/Layout';
import { OnboardingTestIDs } from '../testIDs';

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
    <OnboardingPage headerBack={false} contentContainerProps={{ gap: '$10' }}>
      <YStack gap="$2">
        <OnboardingIconBadge
          icon="CheckmarkSolid"
          iconColor="$iconOnColor"
          bg="$bgSuccessStrong"
          p="$5"
          mb="$5"
        />
        <SizableText size="$heading2xl">
          {intl.formatMessage({ id: ETranslations.new_pin_created })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.new_pin_created_desc,
          })}
        </SizableText>
      </YStack>
      <Button
        testID={OnboardingTestIDs.newPinCreatedCloseBtn}
        size="large"
        onPress={handleClose}
        maxWidth={320}
      >
        {intl.formatMessage({ id: ETranslations.global_close })}
      </Button>
    </OnboardingPage>
  );
}

export { NewPinCreatedPage as default };
