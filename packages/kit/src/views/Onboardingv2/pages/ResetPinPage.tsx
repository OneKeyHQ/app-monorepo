import { useCallback } from 'react';

import {
  Button,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

const STEPS = [
  {
    title: 'Open Other Device',
    description:
      'Go to another device where your OneKey account is signed in with your email',
  },
  {
    title: 'Go to Settings',
    description: 'In Settings, select "Security" and then "Reset PIN"',
  },
  {
    title: 'Set Your New PIN',
    description:
      "Once you've set your new PIN, you can now login to your wallet on this device",
  },
];

function ResetPinPage() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const handleDone = useCallback(() => {
    navigation.pop();
  }, [navigation]);
  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <YStack gap="$2">
              <SizableText size="$heading2xl">
                Reset PIN using another device
              </SizableText>
              <SizableText size="$bodyLg" color="$textSubdued">
                For security, you can only reset your PIN in other devices where
                you are logged in
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
                  I've done these steps
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
              I've done these steps
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}

export { ResetPinPage as default };
