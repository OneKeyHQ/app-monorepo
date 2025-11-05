import {
  Button,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import { OnboardingLayout } from '../components/OnboardingLayout';

export default function ShowRecoveryPhrase() {
  const navigation = useAppNavigation();

  // Placeholder recovery phrase - user will add real data
  const recoveryPhrase = [
    'word1',
    'word2',
    'word3',
    'word4',
    'word5',
    'word6',
    'word7',
    'word8',
    'word9',
    'word10',
    'word11',
    'word12',
  ];

  const handleContinue = () => {
    navigation.push(EOnboardingPagesV2.VerifyRecoveryPhrase);
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Wallet #1" />
        <OnboardingLayout.Body>
          <YStack gap="$5">
            <YStack gap="$3">
              <SizableText size="$heading2xl">
                Note down phrase in order and keep them safe.
              </SizableText>
            </YStack>

            <XStack mx="$-1" py="$5" flexWrap="wrap">
              {recoveryPhrase.map((phrase, index) => (
                <YStack key={index} p="$1" flex={1} w="50%">
                  <XStack
                    py="$2"
                    px="$1"
                    bg="$bg"
                    borderRadius="$3"
                    gap="$3"
                    borderWidth={1}
                    borderColor="$border"
                  >
                    <SizableText
                      size="$bodyLg"
                      color="$textDisabled"
                      w="$5"
                      textAlign="right"
                    >
                      {index + 1}
                    </SizableText>
                    <SizableText size="$bodyLg">{phrase}</SizableText>
                  </XStack>
                </YStack>
              ))}
            </XStack>

            <Button size="large" variant="primary" onPress={handleContinue}>
              I've saved the phrases
            </Button>
          </YStack>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
