import { useEffect } from 'react';

import { Button, Icon, Page, SizableText, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

function NewPinCreatedPage() {
  const navigation = useAppNavigation();

  // close this page 5s later automatically
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.pop();
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
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
              <SizableText size="$heading2xl">New PIN Created</SizableText>
              <SizableText size="$bodyLg" color="$textSubdued">
                You can change your PIN at anytime through Settings.
              </SizableText>
            </YStack>
            <Button size="large" onPress={() => navigation.pop()}>
              Close
            </Button>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export { NewPinCreatedPage as default };
